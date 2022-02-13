import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { byName, type Place, type Review } from "../domain/place";
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

/**
 * Reads the message off whatever a query or mutation rejected with. RTK Query
 * hands back either our QueryError or its own SerializedError, so this narrows
 * structurally rather than by type.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === "string" && message) return message;
  }
  return fallback;
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

/**
 * There is no HTTP endpoint to point a baseQuery at: the repository talks to
 * the Firestore SDK or to a local array. fakeBaseQuery keeps RTK Query's
 * caching, deduplication and request lifecycle over an arbitrary async source.
 *
 * None of the mutations invalidate `listPlaces`. Doing so would re-read the
 * whole collection, one document read per row, to learn about a single row
 * already in hand. They patch the cache instead, which also makes the change
 * appear immediately.
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

      // Not optimistic: the store assigns the id, and a row inserted under a
      // guessed one would have to be moved when the real id arrives.
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

        // A rejected write leaves no trace. The rules are the authority, and
        // the screen has to agree with them.
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
