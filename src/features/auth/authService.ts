import { firebaseConfig } from "../../config";

export interface AuthUser {
  uid: string;
  name: string;
  photoUrl: string | null;
}

/** Sign-in is hidden entirely when the app runs on fixtures. */
export const authAvailable = firebaseConfig !== null;

// Nothing here is imported statically: on a fixtures-only build the Firebase
// SDK must not reach the bundle at all, and most visitors never sign in.
async function auth() {
  if (!firebaseConfig) throw new Error("Firebase is not configured");
  const [{ getAuth }, { firebaseApp }] = await Promise.all([
    import("firebase/auth"),
    import("../../data/firebaseApp"),
  ]);
  return getAuth(firebaseApp(firebaseConfig));
}

function toUser(user: {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}): AuthUser {
  return {
    uid: user.uid,
    name: user.displayName ?? "Signed in",
    photoUrl: user.photoURL,
  };
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const credential = await signInWithPopup(await auth(), new GoogleAuthProvider());
  return toUser(credential.user);
}

export async function signOut(): Promise<void> {
  const { signOut: firebaseSignOut } = await import("firebase/auth");
  await firebaseSignOut(await auth());
}

/**
 * Reports the restored session on load and every change after it. Returns an
 * unsubscribe; callers must invoke it or the listener outlives the component.
 */
export function observeAuth(onChange: (user: AuthUser | null) => void): () => void {
  if (!authAvailable) return () => undefined;

  let unsubscribe: (() => void) | null = null;
  // The SDK loads asynchronously, so the caller can unsubscribe before there is
  // anything to unsubscribe from.
  const controller = new AbortController();

  void (async () => {
    const { onAuthStateChanged } = await import("firebase/auth");
    const instance = await auth();
    if (controller.signal.aborted) return;

    unsubscribe = onAuthStateChanged(instance, (user) => {
      onChange(user ? toUser(user) : null);
    });
  })();

  return () => {
    controller.abort();
    unsubscribe?.();
  };
}
