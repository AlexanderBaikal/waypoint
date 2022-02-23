import { createSelector } from "@reduxjs/toolkit";
import { presentCategories } from "../domain/categories";
import type { Place } from "../domain/place";
import { filterPlaces } from "../domain/search";
import type { RootState } from "./store";

/**
 * What the screen is made of, derived in one place rather than in the
 * component that happens to draw it.
 *
 * The field selectors exist so that a component subscribes to the piece of
 * state it reads: `state => state.ui` hands its reader a new object on every
 * keystroke, panel toggle and theme switch alike, whichever of them it
 * actually cares about.
 *
 * The derived ones take the places and the search text as arguments instead of
 * reading them from the store, because neither is the store's: the place list
 * belongs to RTK Query's cache, and the text is React's deferred copy of the
 * query, lagging the field on purpose. They are memoised here all the same,
 * where the reasoning about what may share an identity with what belongs.
 */

/** The place list, passed in: RTK Query owns the cache it comes from. */
const argPlaces = (_state: RootState, places: readonly Place[]) => places;

/** The deferred query, passed in: the lag it carries is React's, not ours. */
const argQuery = (_state: RootState, _places: readonly Place[], query: string) => query;

export const selectQuery = (state: RootState) => state.ui.query;
export const selectCategories = (state: RootState) => state.ui.categories;
export const selectSavedOnly = (state: RootState) => state.ui.savedOnly;
export const selectSelectedPlaceId = (state: RootState) => state.ui.selectedPlaceId;
export const selectListExpanded = (state: RootState) => state.ui.listExpanded;
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectEditor = (state: RootState) => state.ui.editor;
export const selectSavedIds = (state: RootState) => state.saved.ids;

/**
 * Whether the user has asked for anything. Decides both whether the map
 * reframes and whether the panel lists results at all.
 */
export const selectFiltering = createSelector(
  [argQuery, selectCategories, selectSavedOnly],
  (query, categories, savedOnly) =>
    query.trim() !== "" || categories.length > 0 || savedOnly,
);

/** What the search alone matches, before this browser's bookmarks narrow it. */
const selectMatchedPlaces = createSelector(
  [argPlaces, argQuery, selectCategories],
  (places, query, categories) => filterPlaces(places, { query, categories }),
);

/**
 * Saved is applied after the search rather than inside it: which places this
 * browser bookmarked is not something the domain scores.
 *
 * In two memoised steps rather than one so that `savedIds` is not an input of
 * the search. Bookmarking replaces that array, and folding the two together
 * would re-run the search and hand back a new array of the same places on
 * every press — which the marker layer reads as a new dataset and rebuilds,
 * and the map as a reason to reframe.
 */
export const selectVisiblePlaces = createSelector(
  [selectMatchedPlaces, selectSavedOnly, selectSavedIds],
  (matched, savedOnly, savedIds) => {
    if (!savedOnly) return matched;

    const saved = new Set(savedIds);
    return matched.filter((place) => saved.has(place.id));
  },
);

export const selectSelectedPlace = createSelector(
  [argPlaces, selectSelectedPlaceId],
  (places, selectedPlaceId) =>
    places.find((place) => place.id === selectedPlaceId) ?? null,
);

/**
 * A deep link can name a place the current filter excludes, and the map still
 * has to show it. Memoised because the marker layer keys its work off this
 * array's identity.
 */
export const selectMarkerPlaces = createSelector(
  [selectVisiblePlaces, selectSelectedPlace],
  (visible, selected) =>
    selected && !visible.includes(selected) ? [...visible, selected] : visible,
);

/** Only the categories the dataset actually has get a chip. */
export const selectAvailableCategories = createSelector([argPlaces], presentCategories);

/** What the type field suggests from: the types already in use on the map. */
export const selectKnownTypes = createSelector([argPlaces], (places) =>
  places.map((place) => place.type),
);
