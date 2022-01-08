import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import type { FirebaseConfig } from "../config";
import type { Place, Review } from "../domain/place";
import { firebaseApp } from "./firebaseApp";
import {
  readCoords,
  readDate,
  readNumber,
  readSchedule,
  readString,
  slugify,
} from "./normalise";
import { RepositoryError, type PlacesRepository } from "./repository";

/**
 * Adapter over the 2021 schema.
 *
 * Two things make this more than a `map()`:
 *
 * 1. Place data is split across `places` (map pins) and `descriptions` (detail
 *    pages), and the two drifted — each holds rows the other lacks. We read the
 *    union and merge by document id.
 * 2. The stored values are messier than their nominal shape; src/data/normalise.ts
 *    holds the readers that deal with that.
 *
 * Nothing above leaks past this file; the rest of the app sees domain types.
 */

interface MergedPlace {
  place: Place;
  /** Storage folder the old uploader used, which is what reviews point at. */
  reviewKey: string;
}

function mergeDocs(
  summaries: Map<string, DocumentData>,
  details: Map<string, DocumentData>,
): MergedPlace[] {
  const keys = new Set([...summaries.keys(), ...details.keys()]);

  return [...keys]
    .map((key) => {
      const summary = summaries.get(key) ?? {};
      const detail = details.get(key) ?? {};

      const name = readString(summary.name) ?? readString(detail.name) ?? readString(key);
      const coords = readCoords(summary.coords) ?? readCoords(detail.coords);
      if (!name || !coords) return null;

      const cover = readString(detail.imageUrl);
      const ratingCount = readNumber(detail.ratingCount) ?? 0;
      const ratingValue = readNumber(detail.ratingValue);

      const place: Place = {
        id: slugify(name),
        name,
        type: readString(summary.type) ?? readString(detail.type) ?? "Other",
        coords,
        address: readString(detail.address),
        phone: readString(detail.phoneNumber),
        website: readString(detail.website),
        about: readString(detail.about),
        cover,
        photos: cover ? [cover] : [],
        rating:
          ratingCount > 0 && ratingValue !== null
            ? { value: ratingValue, count: ratingCount }
            : null,
        schedule: readSchedule(detail.schedule),
        authorId: readString(summary.author) ?? readString(detail.author),
      };

      return {
        place,
        reviewKey: readString(detail.photoFolder) ?? name,
      };
    })
    .filter((entry): entry is MergedPlace => entry !== null)
    .sort((a, b) => a.place.name.localeCompare(b.place.name));
}

async function readCollection(
  db: Firestore,
  name: string,
): Promise<Map<string, DocumentData>> {
  const snapshot = await getDocs(collection(db, name));
  return new Map(snapshot.docs.map((doc) => [doc.id, doc.data()]));
}

export function createLegacyFirestoreRepository(
  config: FirebaseConfig,
): PlacesRepository {
  const db = getFirestore(firebaseApp(config));

  // listReviews needs the legacy key for a slug, so both calls share one load.
  // Kept as a promise so concurrent callers wait on the same request.
  let merged: Promise<MergedPlace[]> | null = null;

  const load = (): Promise<MergedPlace[]> => {
    merged ??= Promise.all([
      readCollection(db, "places"),
      readCollection(db, "descriptions"),
    ])
      .then(([summaries, details]) => mergeDocs(summaries, details))
      .catch((error: unknown) => {
        merged = null; // let the next attempt retry instead of caching a failure
        throw new RepositoryError("Could not load places from Firestore", error);
      });
    return merged;
  };

  // The 2021 database is read-only from here. Writing into a schema whose two
  // halves have already drifted apart would deepen the drift, and there is
  // nowhere sane to put an owner: its rows predate the idea of one.
  const readOnly = () =>
    Promise.reject(
      new RepositoryError(
        "The inherited schema is read-only. Seed a project with " +
          "scripts/seed-firestore.mjs and drop VITE_FIREBASE_SCHEMA to write.",
      ),
    );

  return {
    source: "firestore",
    writable: false,

    createPlace: readOnly,
    updatePlace: readOnly,
    addReview: readOnly,

    listPlaces: async () => (await load()).map((entry) => entry.place),

    listReviews: async (placeId) => {
      const entry = (await load()).find((candidate) => candidate.place.id === placeId);
      if (!entry) return [];

      try {
        const snapshot = await getDocs(
          query(collection(db, "comments"), where("forPlace", "==", entry.reviewKey)),
        );

        return snapshot.docs
          .map((doc): Review | null => {
            const data = doc.data();
            const author = (data.author ?? {}) as Record<string, unknown>;
            const text = readString(data.text);
            if (!text) return null;

            const photoUrl = readString(author.photoURL);
            return {
              id: doc.id,
              placeId,
              author: {
                name: readString(author.name) ?? "Anonymous",
                photoUrl: photoUrl?.startsWith("http") ? photoUrl : null,
              },
              rating: readNumber(data.value) ?? 0,
              text,
              date: readDate(data.date),
              photos: Array.isArray(data.photos)
                ? data.photos.filter(
                    (photo): photo is string => typeof photo === "string",
                  )
                : [],
            };
          })
          .filter((review): review is Review => review !== null)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      } catch (error) {
        throw new RepositoryError(`Could not load reviews for ${placeId}`, error);
      }
    },
  };
}
