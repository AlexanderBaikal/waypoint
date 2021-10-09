import type { Place, Review } from "../domain/place";
import type { PlacesRepository } from "./repository";
import placesJson from "./fixtures/places.json";
import reviewsJson from "./fixtures/reviews.json";

// These files are produced by scripts/build-fixtures.mjs from a snapshot of the
// live database and are checked in, so their shape is ours rather than a
// third party's. That is why they are cast instead of validated the way the
// Firestore adapter validates what it reads.
const places = placesJson as Place[];
const reviews = reviewsJson as Review[];

export function createFixtureRepository(): PlacesRepository {
  return {
    source: "fixtures",

    listPlaces: () => Promise.resolve(places),

    listReviews: (placeId) =>
      Promise.resolve(reviews.filter((review) => review.placeId === placeId)),
  };
}
