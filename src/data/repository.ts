import type { Place, Review } from "../domain/place";

export type RepositorySource = "firestore" | "fixtures";

/**
 * Everything the UI knows about persistence. Swapping Firestore for another
 * backend means writing one more implementation of this, not touching
 * components — see src/data/firestore.ts for the shape of the work involved.
 */
export interface PlacesRepository {
  readonly source: RepositorySource;
  listPlaces(): Promise<Place[]>;
  listReviews(placeId: string): Promise<Review[]>;
}

export class RepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "RepositoryError";
  }
}
