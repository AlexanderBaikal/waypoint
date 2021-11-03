import { firebaseConfig } from "../../config";

const STORAGE_KEY = "waypoint:saved";

/** Private browsing and blocked storage both throw; saving is not worth a crash. */
export function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeLocal(ids: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Nothing useful to do — the list still works for this session.
  }
}

async function userDoc(uid: string) {
  if (!firebaseConfig) throw new Error("Firebase is not configured");
  const [{ doc, getFirestore }, { firebaseApp }] = await Promise.all([
    import("firebase/firestore"),
    import("../../data/firebaseApp"),
  ]);
  return doc(getFirestore(firebaseApp(firebaseConfig)), "users", uid);
}

export async function readRemote(uid: string): Promise<string[]> {
  const { getDoc } = await import("firebase/firestore");
  const snapshot = await getDoc(await userDoc(uid));
  const ids: unknown = snapshot.data()?.savedPlaceIds;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string")
    : [];
}

export async function writeRemote(uid: string, ids: readonly string[]): Promise<void> {
  const { setDoc, serverTimestamp } = await import("firebase/firestore");
  await setDoc(await userDoc(uid), {
    savedPlaceIds: [...ids],
    updatedAt: serverTimestamp(),
  });
}
