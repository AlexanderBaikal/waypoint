import { useAppSelector } from "../../app/hooks";
import type { Author } from "../../domain/placeInput";
import { authAvailable } from "./authService";

/**
 * A local identity for the offline build. Without Firebase there is no session
 * to attribute a write to, and the demo still has to let someone try the
 * feature — so edits are signed by the browser making them and stay there.
 * `mayEdit` treats it like any other author: you can change what you added.
 */
const LOCAL: Author = { uid: "local", name: "You", photoUrl: null };

export interface WriteIdentity {
  /** Null exactly when a sign-in is what stands between you and writing. */
  author: Author | null;
  needsSignIn: boolean;
}

/**
 * Who the app would record as the author of a write right now.
 *
 * Three cases rather than two: signed in, signed out with somewhere to sign in
 * to, and no sign-in configured at all. Collapsing the last two would either
 * hide the feature from the published demo or show a sign-in button that
 * cannot work.
 */
export function useWriteIdentity(): WriteIdentity {
  const user = useAppSelector((state) => state.auth.user);

  if (!authAvailable) return { author: LOCAL, needsSignIn: false };
  if (user) return { author: user, needsSignIn: false };
  return { author: null, needsSignIn: true };
}

/** True when writes are stored in this browser rather than in a database. */
export const writesAreLocal = !authAvailable;
