import type { Author, PlaceInput, ReviewInput } from "../domain/placeInput";
import type { Place, Review } from "../domain/place";

export type RepositorySource = "firestore" | "fixtures";

/**
 * Everything the UI knows about persistence. Swapping Firestore for another
 * backend means writing one more implementation of this, not touching
 * components — see src/data/firestore.ts and src/data/fixtures.ts for the two
 * that exist.
 *
 * Writes take their author explicitly rather than reaching for the session.
 * The caller already knows who is signed in, and a repository that reads
 * ambient state cannot be tested without one.
 */
export interface PlacesRepository {
  readonly source: RepositorySource;

  listPlaces(): Promise<Place[]>;
  listReviews(placeId: string): Promise<Review[]>;

  /** Whether this backend accepts writes at all. */
  readonly writable: boolean;

  createPlace(input: PlaceInput, author: Author): Promise<Place>;
  updatePlace(placeId: string, input: PlaceInput, author: Author): Promise<Place>;
  /** Adds the review and folds it into the place's rating in one step. */
  addReview(placeId: string, input: ReviewInput, author: Author): Promise<Review>;
}

export class RepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "RepositoryError";
  }
}

/**
 * Thrown when the store accepted the request but the access model rejected it.
 * Separate from RepositoryError because the UI says something different: not
 * "try again" but "this is not yours to edit".
 */
export class NotAllowedError extends RepositoryError {
  constructor(message = "You do not have permission to change this") {
    super(message);
    this.name = "NotAllowedError";
  }
}

/**
 * A place with no author is community-maintained: anyone signed in may edit it,
 * which is the same bargain OpenStreetMap makes and where most of this data
 * came from. A place someone created belongs to them.
 */
export function mayEdit(place: Pick<Place, "authorId">, uid: string | null): boolean {
  if (!uid) return false;
  return place.authorId === null || place.authorId === uid;
}

/** Recomputes a rounded average as one more score arrives. */
export function foldRating(
  current: { value: number; count: number } | null,
  score: number,
): { value: number; count: number } {
  const count = (current?.count ?? 0) + 1;
  const total = (current?.value ?? 0) * (current?.count ?? 0) + score;
  return { value: Math.round((total / count) * 10) / 10, count };
}
