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
  /** Narrows the list to this browser's bookmarks. */
  savedOnly: boolean;
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
 * The theme is a preference about this browser rather than about what is on
 * screen, so it lives in localStorage rather than in the deep link. Blocked
 * storage throws, and a preference is not worth a crash.
 *
 * Dark is the default and only an explicit "light" turns it off, so an
 * unreadable value falls to dark. The inline script in index.html makes the
 * same decision before React mounts, to avoid a flash of the light interface;
 * it reads THEME_KEY too, so the two have to agree.
 */
function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Nothing useful to do; the choice still holds for this session.
  }
}

/** Deep links carry the current view, so the state starts from the URL. */
export function initialUiState(search = window.location.search): UiState {
  const params = new URLSearchParams(search);

  return {
    query: params.get("q") ?? "",
    categories: (params.get("cat") ?? "").split(",").filter(isCategory),
    // Deliberately not in the URL either: the saved list belongs to a browser,
    // so a shared link carrying this filter would open on the recipient's own
    // bookmarks, which is not what the sender was looking at.
    savedOnly: false,
    selectedPlaceId: params.get("place"),
    listExpanded: false,
    theme: readTheme(),
    // Deliberately not in the URL: restoring a half-written form from a link
    // would misrepresent what has actually been saved.
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
    savedOnlyToggled(state) {
      state.savedOnly = !state.savedOnly;
    },
    filtersCleared(state) {
      state.query = "";
      state.categories = [];
      state.savedOnly = false;
    },
    placeSelected(state, action: PayloadAction<string | null>) {
      state.selectedPlaceId = action.payload;
      if (action.payload) state.listExpanded = false;
      // Leaving a place closes whatever was being written about it.
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
  savedOnlyToggled,
  filtersCleared,
  placeSelected,
  listExpandedChanged,
  themeToggled,
  editorOpened,
  editorClosed,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
