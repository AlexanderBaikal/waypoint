import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { readLocal, readRemote, writeRemote } from "./savedPlacesService";

export interface SavedState {
  ids: string[];
  syncing: boolean;
}

// Lazy, so a store created later in the session (or in a test) reads whatever
// is in storage at that moment rather than at import time.
const initialState = (): SavedState => ({
  ids: readLocal(),
  syncing: false,
});

/**
 * Signing in on a second device must not lose either list, and there is no
 * sensible way to order "saved on phone" against "saved on laptop", so the two
 * are unioned. Unsaving after signing in propagates normally.
 */
export const syncWithAccount = createAsyncThunk(
  "saved/sync",
  async (uid: string, { getState }) => {
    const local = (getState() as { saved: SavedState }).saved.ids;
    const remote = await readRemote(uid);
    const merged = [...new Set([...remote, ...local])];

    if (merged.length !== remote.length) await writeRemote(uid, merged);
    return merged;
  },
);

const savedSlice = createSlice({
  name: "saved",
  initialState,
  reducers: {
    savedToggled(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.ids = state.ids.includes(id)
        ? state.ids.filter((entry) => entry !== id)
        : [...state.ids, id];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncWithAccount.pending, (state) => {
        state.syncing = true;
      })
      .addCase(syncWithAccount.fulfilled, (state, action) => {
        state.syncing = false;
        state.ids = action.payload;
      })
      .addCase(syncWithAccount.rejected, (state) => {
        // Keep the local list; it is still the user's list.
        state.syncing = false;
      });
  },
});

export const { savedToggled } = savedSlice.actions;
export const savedReducer = savedSlice.reducer;
