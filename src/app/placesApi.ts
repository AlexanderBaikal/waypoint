import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Place, Review } from "../domain/place";
import { getRepository } from "../data";
import { RepositoryError } from "../data/repository";

export interface QueryError {
  message: string;
}

function toQueryError(error: unknown): QueryError {
  if (error instanceof RepositoryError) return { message: error.message };
  if (error instanceof Error) return { message: error.message };
  return { message: "Something went wrong" };
}

/**
 * There is no HTTP endpoint to point a baseQuery at — the repository talks to
 * the Firestore SDK or to a local array. fakeBaseQuery lets us keep RTK Query's
 * caching, deduplication and request lifecycle over an arbitrary async source.
 */
export const placesApi = createApi({
  reducerPath: "placesApi",
  baseQuery: fakeBaseQuery<QueryError>(),
  tagTypes: ["Place", "Review"],
  endpoints: (build) => ({
    // `void` is RTK Query's spelling for "no argument"; the rule cannot tell
    // this apart from a genuinely misplaced void.
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    listPlaces: build.query<Place[], void>({
      queryFn: async () => {
        try {
          const repository = await getRepository();
          return { data: await repository.listPlaces() };
        } catch (error) {
          return { error: toQueryError(error) };
        }
      },
      providesTags: (places = []) => [
        { type: "Place" as const, id: "LIST" },
        ...places.map((place) => ({ type: "Place" as const, id: place.id })),
      ],
    }),

    listReviews: build.query<Review[], string>({
      queryFn: async (placeId) => {
        try {
          const repository = await getRepository();
          return { data: await repository.listReviews(placeId) };
        } catch (error) {
          return { error: toQueryError(error) };
        }
      },
      providesTags: (_reviews, _error, placeId) => [{ type: "Review", id: placeId }],
    }),
  }),
});

export const { useListPlacesQuery, useListReviewsQuery } = placesApi;
