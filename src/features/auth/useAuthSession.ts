import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { syncWithAccount } from "../saved/savedSlice";
import { observeAuth } from "./authService";
import { sessionRestored } from "./authSlice";

/**
 * Bridges the Firebase auth listener into the store, and pulls the saved list
 * down whenever a session appears. Mounted once, at the app root.
 */
export function useAuthSession(): void {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((state) => state.auth.user?.uid);

  useEffect(() => observeAuth((user) => dispatch(sessionRestored(user))), [dispatch]);

  useEffect(() => {
    if (uid) void dispatch(syncWithAccount(uid));
  }, [dispatch, uid]);
}
