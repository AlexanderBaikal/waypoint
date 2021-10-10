import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { CATEGORIES, type Category } from "../domain/categories";

export interface UiState {
  query: string;
  categories: Category[];
  selectedPlaceId: string | null;
  /** Mobile only: whether the results sheet covers the map. */
  listExpanded: boolean;
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** Deep links carry the current view, so the state starts from the URL. */
export function initialUiState(search = window.location.search): UiState {
  const params = new URLSearchParams(search);

  return {
    query: params.get("q") ?? "",
    categories: (params.get("cat") ?? "").split(",").filter(isCategory),
    selectedPlaceId: params.get("place"),
    listExpanded: false,
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
  },
});

export const {
  queryChanged,
  categoryToggled,
  filtersCleared,
  placeSelected,
  listExpandedChanged,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
