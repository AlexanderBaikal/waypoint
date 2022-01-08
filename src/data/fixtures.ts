import type { Place, Review } from "../domain/place";
import { uniqueSlug } from "../domain/slug";
import {
  NotAllowedError,
  RepositoryError,
  foldRating,
  mayEdit,
  type PlacesRepository,
} from "./repository";
import placesJson from "./fixtures/places.json";
import reviewsJson from "./fixtures/reviews.json";

// These files are produced by scripts/import-osm.mjs and are checked in, so
// their shape is ours rather than a third party's. That is why they are cast
// instead of validated the way the Firestore adapter validates what it reads.
const basePlaces = placesJson as Place[];
const baseReviews = reviewsJson as Review[];

const STORAGE_KEY = "waypoint:edits";

interface Overlay {
  /** Created and edited places, keyed by id. Wins over the bundled copy. */
  places: Record<string, Place>;
  reviews: Review[];
}

/** A fresh one every time: the caller mutates what it gets back, and a shared
 *  constant would carry one session's edits into the next. */
const empty = (): Overlay => ({ places: {}, reviews: [] });

/**
 * Without Firebase configured the app still has to demonstrate writing — it is
 * how anyone reviewing this repository sees the feature at all. Edits go to
 * localStorage, so they survive a reload and belong to this browser alone.
 *
 * Private browsing and blocked storage both throw on access; an edit that
 * cannot be persisted still applies for the session rather than crashing.
 */
function readOverlay(): Overlay {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Overlay>;
    return {
      places: parsed.places ?? {},
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    };
  } catch {
    return empty();
  }
}

function writeOverlay(overlay: Overlay): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    // Nothing useful to do; the edit still holds for this session.
  }
}

export function createFixtureRepository(): PlacesRepository {
  const overlay = readOverlay();

  const merged = new Map(basePlaces.map((place) => [place.id, place]));
  for (const [id, place] of Object.entries(overlay.places)) merged.set(id, place);

  const byName = (a: Place, b: Place) => a.name.localeCompare(b.name, "ru");
  let places = [...merged.values()].sort(byName);
  let reviews = [...baseReviews, ...overlay.reviews];

  const find = (placeId: string): Place => {
    const place = places.find((candidate) => candidate.id === placeId);
    if (!place) throw new RepositoryError(`No place with id ${placeId}`);
    return place;
  };

  /** Replaces one place everywhere, and remembers it for the next session. */
  const commit = (place: Place) => {
    overlay.places[place.id] = place;
    merged.set(place.id, place);
    places = [...merged.values()].sort(byName);
    writeOverlay(overlay);
  };

  return {
    source: "fixtures",
    writable: true,

    listPlaces: () => Promise.resolve(places),

    listReviews: (placeId) =>
      Promise.resolve(
        reviews
          .filter((review) => review.placeId === placeId)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      ),

    createPlace: (input, author) => {
      const id = uniqueSlug(input.name, (slug) => merged.has(slug));
      const place: Place = {
        id,
        name: input.name.trim(),
        type: input.type.trim(),
        coords: input.coords,
        address: input.address,
        phone: input.phone,
        website: input.website,
        about: input.about,
        cover: null,
        photos: [],
        rating: null,
        schedule: input.schedule,
        authorId: author.uid,
      };
      commit(place);
      return Promise.resolve(place);
    },

    updatePlace: (placeId, input, author) => {
      const existing = find(placeId);
      if (!mayEdit(existing, author.uid)) return Promise.reject(new NotAllowedError());

      const place: Place = {
        ...existing,
        name: input.name.trim(),
        type: input.type.trim(),
        coords: input.coords,
        address: input.address,
        phone: input.phone,
        website: input.website,
        about: input.about,
        schedule: input.schedule,
      };
      commit(place);
      return Promise.resolve(place);
    },

    addReview: (placeId, input, author) => {
      const place = find(placeId);
      const review: Review = {
        id: `local-${placeId}-${String(reviews.length + 1)}`,
        placeId,
        author: { name: author.name, photoUrl: author.photoUrl },
        rating: input.rating,
        text: input.text.trim(),
        date: new Date().toISOString(),
        photos: [],
      };

      reviews = [...reviews, review];
      overlay.reviews = [...overlay.reviews, review];
      commit({ ...place, rating: foldRating(place.rating, input.rating) });

      return Promise.resolve(review);
    },
  };
}
