import { byName, type Place, type Review } from "../domain/place";
import { uniqueSlug } from "../domain/slug";
import {
  NotAllowedError,
  RepositoryError,
  applyInput,
  foldRating,
  mayEdit,
  newPlace,
  type PlacesRepository,
} from "./repository";
import placesJson from "./fixtures/places.json";
import reviewsJson from "./fixtures/reviews.json";

// Produced by scripts/import-osm.mjs and checked in, so the shape is ours.
// Hence the cast, where the Firestore adapter validates what it reads.
const basePlaces = placesJson as Place[];
const baseReviews = reviewsJson as Review[];

const STORAGE_KEY = "waypoint:edits";

interface Overlay {
  /** Created and edited places, keyed by id. Wins over the bundled copy. */
  places: Record<string, Place>;
  reviews: Review[];
}

/** A fresh one every time: the caller mutates what it gets back. */
const empty = (): Overlay => ({ places: {}, reviews: [] });

/**
 * Writing still works without Firebase configured, which is how the published
 * demo shows the feature. Edits go to localStorage, so they survive a reload
 * and belong to this browser alone.
 *
 * Private browsing and blocked storage both throw on access; an edit that
 * cannot be persisted still applies for the session.
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
      const place = newPlace(
        uniqueSlug(input.name, (slug) => merged.has(slug)),
        input,
        author,
      );
      commit(place);
      return Promise.resolve(place);
    },

    updatePlace: (placeId, input, author) => {
      const existing = find(placeId);
      if (!mayEdit(existing, author.uid)) return Promise.reject(new NotAllowedError());

      const place = applyInput(existing, input);
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
