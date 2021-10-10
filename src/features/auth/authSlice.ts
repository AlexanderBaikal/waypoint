import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { signInWithGoogle, signOut, type AuthUser } from "./authService";

export interface AuthState {
  user: AuthUser | null;
  /** `restoring` until Firebase reports whether a session already exists. */
  status: "restoring" | "idle" | "pending";
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "restoring",
  error: null,
};

export const signIn = createAsyncThunk("auth/signIn", () => signInWithGoogle());
export const signOutUser = createAsyncThunk("auth/signOut", () => signOut());

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionRestored(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.status = "idle";
    },
    errorDismissed(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.status = "pending";
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.status = "idle";
        state.user = action.payload;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.status = "idle";
        // Closing the popup is a normal thing to do, not an error worth showing.
        const message = action.error.message ?? "";
        state.error = message.includes("popup-closed-by-user")
          ? null
          : "Could not sign in. Please try again.";
      })
      .addCase(signOutUser.fulfilled, (state) => {
        state.user = null;
      });
  },
});

export const { sessionRestored, errorDismissed } = authSlice.actions;
export const authReducer = authSlice.reducer;
