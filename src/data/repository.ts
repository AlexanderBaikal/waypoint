import type { Author, PlaceInput, ReviewInput } from "../domain/placeInput";
import type { Place, Review } from "../domain/place";

export type RepositorySource = "firestore" | "fixtures";

/**
 * Everything the UI knows about persistence. Swapping Firestore for another
 * backend means writing one more implementation of this rather than touching
 * components; see firestore.ts and fixtures.ts for the two that exist.
 *
 * Writes take their author explicitly rather than reading the session, so the
 * implementations stay testable without one.
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
 * Separate from RepositoryError because the UI says "this is not yours to edit"
 * rather than "try again".
 */
export class NotAllowedError extends RepositoryError {
  constructor(message = "You do not have permission to change this") {
    super(message);
    this.name = "NotAllowedError";
  }
}

/**
 * A place with no author is community-maintained and editable by anyone signed
 * in, matching the terms most of this data arrived under. A place someone
 * created belongs to them.
 */
export function mayEdit(place: Pick<Place, "authorId">, uid: string | null): boolean {
  if (!uid) return false;
  return place.authorId === null || place.authorId === uid;
}

/**
 * Folds a form's fields onto a place. Both repositories build their answer to
 * updatePlace through here, so the two cannot come to disagree about what an
 * edit does — in particular about the credit rule below, which was stated
 * separately in each of them.
 *
 * Everything not named here is not a person's to set: id, photos, rating and
 * author survive the edit untouched.
 */
export function applyInput(place: Place, input: PlaceInput): Place {
  return {
    ...place,
    name: input.name.trim(),
    type: input.type.trim(),
    coords: input.coords,
    address: input.address,
    phone: input.phone,
    website: input.website,
    about: input.about,
    cover: input.cover,
    // A different link is a different photograph, and the stored credit names
    // the author of the old one. Kept while the link is untouched, so editing a
    // phone number does not strip attribution off a borrowed picture.
    coverCredit: input.cover === place.cover ? place.coverCredit : null,
    schedule: input.schedule,
  };
}

/**
 * A place the moment someone adds it. No photographs, no rating and no credit:
 * a pasted cover is the author's own link, not one this project sourced and
 * owes attribution for.
 */
export function newPlace(id: string, input: PlaceInput, author: Author): Place {
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
