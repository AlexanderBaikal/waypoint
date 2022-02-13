import {
  collection,
  doc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  GeoPoint,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import type { FirebaseConfig } from "../config";
import { byName, type Place, type Review } from "../domain/place";
import type { PlaceInput } from "../domain/placeInput";
import { uniqueSlug } from "../domain/slug";
import { firebaseApp } from "./firebaseApp";
import {
  readCoords,
  readDate,
  readNumber,
  readPhotoCredit,
  readSchedule,
  readString,
} from "./normalise";
import {
  NotAllowedError,
  RepositoryError,
  foldRating,
  mayEdit,
  type PlacesRepository,
} from "./repository";

/**
 * Adapter over the schema this project seeds for itself in
 * scripts/seed-firestore.mjs: one document per place, reviews as a
 * subcollection beneath it. The inherited 2021 schema is a different shape and
 * lives in firestoreLegacy.ts, selected by `VITE_FIREBASE_SCHEMA=legacy`.
 *
 * Ratings are denormalised onto the place as well as living in the reviews,
 * because the results list shows a rating per row and reading a subcollection
 * for each would turn one query into hundreds. The transaction in addReview is
 * what keeps the two consistent.
 */

const PLACES = "places";
const REVIEWS = "reviews";

function toPlace(id: string, data: DocumentData): Place | null {
  const name = readString(data.name);
  const coords = readCoords(data.coords);
  if (!name || !coords) return null;

  const ratingCount = readNumber(data.ratingCount) ?? 0;
  const ratingValue = readNumber(data.ratingValue);
  const photos = Array.isArray(data.photos)
    ? data.photos.filter((photo): photo is string => typeof photo === "string")
    : [];

  return {
    id,
    name,
    type: readString(data.type) ?? "Other",
    coords,
    address: readString(data.address),
    phone: readString(data.phone),
    website: readString(data.website),
    about: readString(data.about),
    cover: readString(data.cover),
    coverCredit: readPhotoCredit(data.coverCredit),
    photos,
    rating:
      ratingCount > 0 && ratingValue !== null
        ? { value: ratingValue, count: ratingCount }
        : null,
    schedule: readSchedule(data.schedule),
    authorId: readString(data.authorId),
  };
}

function toReview(id: string, placeId: string, data: DocumentData): Review | null {
  const text = readString(data.text);
  if (!text) return null;

  const author = (data.author ?? {}) as Record<string, unknown>;
  const photoUrl = readString(author.photoUrl) ?? readString(author.photoURL);

  return {
    id,
    placeId,
    author: {
      name: readString(author.name) ?? "Anonymous",
      photoUrl: photoUrl?.startsWith("http") ? photoUrl : null,
    },
    rating: readNumber(data.rating) ?? 0,
    text,
    date: readDate(data.date),
    photos: [],
  };
}

/** The stored fields a person may set. Id, rating and author are not among them. */
const toDocument = (input: PlaceInput) => ({
  name: input.name.trim(),
  type: input.type.trim(),
  coords: new GeoPoint(input.coords.lat, input.coords.lng),
  address: input.address,
  phone: input.phone,
  website: input.website,
  about: input.about,
  cover: input.cover,
  schedule: input.schedule,
});

/** Firestore reports a rules rejection as a code, not as a type. */
function rethrow(error: unknown, message: string): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "permission-denied"
  ) {
    throw new NotAllowedError();
  }
  throw new RepositoryError(message, error);
}

export function createFirestoreRepository(config: FirebaseConfig): PlacesRepository {
  const db: Firestore = getFirestore(firebaseApp(config));

  // One full read of the collection, shared by every caller and reused for the
  // id-uniqueness check. Dropped after a write so the next read sees it.
  let loaded: Promise<Place[]> | null = null;

  const load = (): Promise<Place[]> => {
    loaded ??= getDocs(collection(db, PLACES))
      .then((snapshot) =>
        snapshot.docs
          .map((entry) => toPlace(entry.id, entry.data()))
          .filter((place): place is Place => place !== null)
          .sort(byName),
      )
      .catch((error: unknown) => {
        loaded = null; // let the next attempt retry instead of caching a failure
        throw new RepositoryError("Could not load places from Firestore", error);
      });
    return loaded;
  };

  const invalidate = () => {
    loaded = null;
  };

  const find = async (placeId: string): Promise<Place> => {
    const place = (await load()).find((candidate) => candidate.id === placeId);
    if (!place) throw new RepositoryError(`No place with id ${placeId}`);
    return place;
  };

  return {
    source: "firestore",
    writable: true,

    listPlaces: () => load(),

    listReviews: async (placeId) => {
      try {
        const snapshot = await getDocs(collection(db, PLACES, placeId, REVIEWS));
        return snapshot.docs
          .map((entry) => toReview(entry.id, placeId, entry.data()))
          .filter((review): review is Review => review !== null)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      } catch (error) {
        return rethrow(error, `Could not load reviews for ${placeId}`);
      }
    },

    createPlace: async (input, author) => {
      const existing = await load();
      const id = uniqueSlug(input.name, (slug) =>
        existing.some((place) => place.id === slug),
      );

      try {
        await setDoc(doc(db, PLACES, id), {
          ...toDocument(input),
          photos: [],
          ratingValue: null,
          ratingCount: 0,
          authorId: author.uid,
          source: "waypoint",
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        return rethrow(error, "Could not save the place");
      }

      invalidate();
      return {
        id,
        name: input.name.trim(),
        type: input.type.trim(),
        coords: input.coords,
        address: input.address,
        phone: input.phone,
        website: input.website,
        about: input.about,
        cover: input.cover,
        coverCredit: null,
        photos: [],
        rating: null,
        schedule: input.schedule,
        authorId: author.uid,
      };
    },

    updatePlace: async (placeId, input, author) => {
      const existing = await find(placeId);
      // Checked here for a useful message; enforced by firestore.rules, which
      // is the copy that matters.
      if (!mayEdit(existing, author.uid)) throw new NotAllowedError();

      // A different link is a different photograph, and the stored credit names
      // the author of the old one. Kept while the link is untouched, so editing
      // a phone number does not strip attribution off a borrowed picture.
      const keepsCover = input.cover === existing.cover;

      try {
        await updateDoc(doc(db, PLACES, placeId), {
          ...toDocument(input),
          ...(keepsCover ? {} : { coverCredit: null }),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        return rethrow(error, "Could not save the place");
      }

      invalidate();
      return {
        ...existing,
        name: input.name.trim(),
        type: input.type.trim(),
        coords: input.coords,
        address: input.address,
        phone: input.phone,
        website: input.website,
        about: input.about,
        cover: input.cover,
        coverCredit: keepsCover ? existing.coverCredit : null,
        schedule: input.schedule,
      };
    },

    addReview: async (placeId, input, author) => {
      const placeRef = doc(db, PLACES, placeId);
      const reviewRef = doc(collection(db, PLACES, placeId, REVIEWS));
      const text = input.text.trim();

      try {
        // The review and the place's rating move together, or the average stops
        // describing the reviews beneath it.
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(placeRef);
          if (!snapshot.exists())
            throw new RepositoryError(`No place with id ${placeId}`);

          const data = snapshot.data();
          const count = readNumber(data.ratingCount) ?? 0;
          const value = readNumber(data.ratingValue);
          const folded = foldRating(
            count > 0 && value !== null ? { value, count } : null,
            input.rating,
          );

          transaction.set(reviewRef, {
            author: { name: author.name, photoUrl: author.photoUrl },
            authorId: author.uid,
            rating: input.rating,
            text,
            date: serverTimestamp(),
          });
          transaction.update(placeRef, {
            ratingValue: folded.value,
            ratingCount: folded.count,
          });
        });
      } catch (error) {
        return rethrow(error, "Could not post the review");
      }

      invalidate();
      return {
        id: reviewRef.id,
        placeId,
        author: { name: author.name, photoUrl: author.photoUrl },
        rating: input.rating,
        text,
        date: new Date().toISOString(),
        photos: [],
      };
    },
  };
}
