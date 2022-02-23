import { configureStore, createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { placesApi } from "./placesApi";
import {
  uiReducer,
  categoryToggled,
  placeSelected,
  queryChanged,
  filtersCleared,
  themeToggled,
} from "./uiSlice";
import { writeTheme } from "./themeStorage";
import { authReducer } from "../features/auth/authSlice";
import {
  savedReducer,
  savedToggled,
  syncWithAccount,
} from "../features/saved/savedSlice";
import { writeLocal, writeRemote } from "../features/saved/savedPlacesService";

const listener = createListenerMiddleware();

// Saved places live in localStorage for everyone and additionally in Firestore
// for signed-in users, so the list survives both a refresh and a new device.
listener.startListening({
  matcher: isAnyOf(savedToggled, syncWithAccount.fulfilled),
  effect: (_action, api) => {
    const state = api.getState() as RootState;
    writeLocal(state.saved.ids);

    const uid = state.auth.user?.uid;
    if (uid) void writeRemote(uid, state.saved.ids).catch(() => undefined);
  },
});

// The theme is remembered the same way, and for the same reason: writing to
// storage from the reducer would make it a function of more than its inputs,
// and one that cannot be replayed.
listener.startListening({
  actionCreator: themeToggled,
  effect: (_action, api) => {
    writeTheme((api.getState() as RootState).ui.theme);
  },
});

// The address bar mirrors the current view so a result can be linked or
// reloaded. replaceState rather than pushState, so typing in the search box
// does not bury the back button under one entry per keystroke.
listener.startListening({
  matcher: isAnyOf(queryChanged, categoryToggled, placeSelected, filtersCleared),
  effect: (_action, api) => {
    const { ui } = api.getState() as RootState;
    const params = new URLSearchParams();
    if (ui.query) params.set("q", ui.query);
    if (ui.categories.length) params.set("cat", ui.categories.join(","));
    if (ui.selectedPlaceId) params.set("place", ui.selectedPlaceId);

    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `?${search}` : window.location.pathname,
    );
  },
});

/** A factory so each test gets an isolated store instead of a shared one. */
export function makeStore() {
  return configureStore({
    reducer: {
      [placesApi.reducerPath]: placesApi.reducer,
      ui: uiReducer,
      auth: authReducer,
      saved: savedReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(listener.middleware).concat(placesApi.middleware),
  });
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
