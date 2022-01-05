import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Basemap } from "../config";
import { CATEGORIES, type Category } from "../domain/categories";

export interface UiState {
  query: string;
  categories: Category[];
  selectedPlaceId: string | null;
  /** Mobile only: whether the results sheet covers the map. */
  listExpanded: boolean;
  basemap: Basemap;
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

const BASEMAP_KEY = "waypoint:basemap";

/**
 * Which basemap is a preference about this browser, not about what is on
 * screen, so it lives in localStorage rather than in the deep link — a URL you
 * send someone should carry the place you are looking at, not how bright you
 * like your map. Blocked storage throws; a preference is not worth a crash.
 */
function readBasemap(): Basemap {
  try {
    return localStorage.getItem(BASEMAP_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function writeBasemap(basemap: Basemap): void {
  try {
    localStorage.setItem(BASEMAP_KEY, basemap);
  } catch {
    // Nothing useful to do — the choice still holds for this session.
  }
}

/** Deep links carry the current view, so the state starts from the URL. */
export function initialUiState(search = window.location.search): UiState {
  const params = new URLSearchParams(search);

  return {
    query: params.get("q") ?? "",
    categories: (params.get("cat") ?? "").split(",").filter(isCategory),
    selectedPlaceId: params.get("place"),
    listExpanded: false,
    basemap: readBasemap(),
  };
}

const uiSlice = createSlice({
  name: "ui",
  initialState: initialUiState,
  reducers: {
    queryChanged(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
    categoryToggled(state, action: PayloadAction<Category>) {
      const category = action.payload;
      state.categories = state.categories.includes(category)
        ? state.categories.filter((entry) => entry !== category)
        : [...state.categories, category];
    },
    filtersCleared(state) {
      state.query = "";
      state.categories = [];
    },
    placeSelected(state, action: PayloadAction<string | null>) {
      state.selectedPlaceId = action.payload;
      if (action.payload) state.listExpanded = false;
    },
    listExpandedChanged(state, action: PayloadAction<boolean>) {
      state.listExpanded = action.payload;
    },
    basemapToggled(state) {
      state.basemap = state.basemap === "dark" ? "light" : "dark";
      writeBasemap(state.basemap);
    },
  },
});

export const {
  queryChanged,
  categoryToggled,
  filtersCleared,
  placeSelected,
  listExpandedChanged,
  basemapToggled,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
