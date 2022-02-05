import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Theme } from "../config";
import { CATEGORIES, type Category } from "../domain/categories";

/**
 * The panel shows one of three things, and which one is a single piece of
 * state rather than a pair of booleans that could both be true.
 */
export type Editor =
  | { mode: "create" }
  | { mode: "edit"; placeId: string }
  | { mode: "review"; placeId: string };

export interface UiState {
  query: string;
  categories: Category[];
  selectedPlaceId: string | null;
  /** Mobile only: whether the results sheet covers the map. */
  listExpanded: boolean;
  theme: Theme;
  /** Null when the panel is reading rather than writing. */
  editor: Editor | null;
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

const THEME_KEY = "waypoint:theme";

/**
 * Which theme is a preference about this browser, not about what is on
 * screen, so it lives in localStorage rather than in the deep link — a URL you
 * send someone should carry the place you are looking at, not how bright you
 * like your map. Blocked storage throws; a preference is not worth a crash.
 */
function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
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
    theme: readTheme(),
    // Deliberately not in the URL: a half-written form is not a view worth
    // sending anyone, and restoring one from a link would be a lie about what
    // has been saved.
    editor: null,
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
      // Walking away from a place closes whatever was being written about it.
      state.editor = null;
    },
    editorOpened(state, action: PayloadAction<Editor>) {
      state.editor = action.payload;
      state.listExpanded = true;
    },
    editorClosed(state) {
      state.editor = null;
    },
    listExpandedChanged(state, action: PayloadAction<boolean>) {
      state.listExpanded = action.payload;
    },
    themeToggled(state) {
      state.theme = state.theme === "dark" ? "light" : "dark";
      writeTheme(state.theme);
    },
  },
});

export const {
  queryChanged,
  categoryToggled,
  filtersCleared,
  placeSelected,
  listExpandedChanged,
  themeToggled,
  editorOpened,
  editorClosed,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
