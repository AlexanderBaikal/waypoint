import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Place, Review } from "../domain/place";
import type { Author, PlaceInput, ReviewInput } from "../domain/placeInput";
import { getRepository } from "../data";
import { NotAllowedError, RepositoryError, foldRating } from "../data/repository";

export interface QueryError {
  message: string;
  /** True when the store refused the write rather than failed at it. */
  forbidden?: boolean;
}

function toQueryError(error: unknown): QueryError {
  if (error instanceof NotAllowedError)
    return { message: error.message, forbidden: true };
  if (error instanceof RepositoryError) return { message: error.message };
  if (error instanceof Error) return { message: error.message };
  return { message: "Something went wrong" };
}

/** Runs a repository call and maps whatever it throws into a QueryError. */
async function attempt<T>(
  run: (repository: Awaited<ReturnType<typeof getRepository>>) => Promise<T>,
) {
  try {
    return { data: await run(await getRepository()) };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name, "ru");

/**
 * There is no HTTP endpoint to point a baseQuery at — the repository talks to
 * the Firestore SDK or to a local array. fakeBaseQuery lets us keep RTK Query's
 * caching, deduplication and request lifecycle over an arbitrary async source.
 *
 * None of the mutations below invalidate `listPlaces`. Invalidating it would
 * re-read the whole collection — sixteen hundred document reads on Firestore's
 * counter — to learn about one changed row we are already holding. They patch
 * the cache instead, which is also what makes the change appear instantly.
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
      queryFn: () => attempt((repository) => repository.listPlaces()),
      providesTags: (places = []) => [
        { type: "Place" as const, id: "LIST" },
        ...places.map((place) => ({ type: "Place" as const, id: place.id })),
      ],
    }),

    listReviews: build.query<Review[], string>({
      queryFn: (placeId) => attempt((repository) => repository.listReviews(placeId)),
      providesTags: (_reviews, _error, placeId) => [{ type: "Review", id: placeId }],
    }),

    createPlace: build.mutation<Place, { input: PlaceInput; author: Author }>({
      queryFn: ({ input, author }) =>
        attempt((repository) => repository.createPlace(input, author)),

      // Not optimistic: the id is assigned by the store, and a row that
      // appears under a guessed id would have to be moved when the real one
      // arrives. Waiting one round trip is honest and imperceptible.
      onQueryStarted: async (_argument, { dispatch, queryFulfilled }) => {
        const { data: created } = await queryFulfilled;
        dispatch(
          placesApi.util.updateQueryData("listPlaces", undefined, (draft) => {
            draft.push(created);
            draft.sort(byName);
          }),
        );
      },
    }),

    updatePlace: build.mutation<
      Place,
      { placeId: string; input: PlaceInput; author: Author }
    >({
      queryFn: ({ placeId, input, author }) =>
        attempt((repository) => repository.updatePlace(placeId, input, author)),

      onQueryStarted: async ({ placeId, input }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          placesApi.util.updateQueryData("listPlaces", undefined, (draft) => {
            const place = draft.find((candidate) => candidate.id === placeId);
            if (!place) return;
            Object.assign(place, {
              name: input.name.trim(),
              type: input.type.trim(),
              coords: input.coords,
              address: input.address,
              phone: input.phone,
              website: input.website,
              about: input.about,
              schedule: input.schedule,
            });
            draft.sort(byName);
          }),
        );

        // A rejected write has to leave no trace: the rules are the authority,
        // and the screen must agree with them rather than with our optimism.
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    addReview: build.mutation<
      Review,
      { placeId: string; input: ReviewInput; author: Author }
    >({
      queryFn: ({ placeId, input, author }) =>
        attempt((repository) => repository.addReview(placeId, input, author)),

      onQueryStarted: async (
        { placeId, input, author },
        { dispatch, queryFulfilled },
      ) => {
        const pending: Review = {
          id: `pending-${placeId}`,
          placeId,
          author: { name: author.name, photoUrl: author.photoUrl },
          rating: input.rating,
          text: input.text.trim(),
          date: new Date().toISOString(),
          photos: [],
        };

        const patches = [
          dispatch(
            placesApi.util.updateQueryData("listReviews", placeId, (draft) => {
              draft.unshift(pending);
            }),
          ),
          dispatch(
            placesApi.util.updateQueryData("listPlaces", undefined, (draft) => {
              const place = draft.find((candidate) => candidate.id === placeId);
              if (place) place.rating = foldRating(place.rating, input.rating);
            }),
          ),
        ];

        try {
          // Swap the placeholder for the stored review, so its real id is in
          // the cache before anything tries to key off it.
          const { data: saved } = await queryFulfilled;
          dispatch(
            placesApi.util.updateQueryData("listReviews", placeId, (draft) => {
              const index = draft.findIndex((review) => review.id === pending.id);
              if (index !== -1) draft[index] = saved;
            }),
          );
        } catch {
          for (const patch of patches) patch.undo();
        }
      },
    }),
  }),
});

export const {
  useListPlacesQuery,
  useListReviewsQuery,
  useCreatePlaceMutation,
  useUpdatePlaceMutation,
  useAddReviewMutation,
} = placesApi;
