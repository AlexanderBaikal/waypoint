import { firebaseConfig, firebaseSchema } from "../config";
import type { PlacesRepository } from "./repository";

let pending: Promise<PlacesRepository> | null = null;

/**
 * Picks the adapter once per session. All three are dynamically imported so
 * the Firebase SDK never reaches the bundle of someone running on fixtures,
 * and the schema nobody selected never reaches it either.
 */
export function getRepository(): Promise<PlacesRepository> {
  // Bound to a local so the null check still holds inside the callback.
  const config = firebaseConfig;

  if (!pending) {
    if (!config) {
      pending = import("./fixtures").then((module) => module.createFixtureRepository());
    } else if (firebaseSchema === "legacy") {
      pending = import("./firestoreLegacy").then((module) =>
        module.createLegacyFirestoreRepository(config),
      );
    } else {
      pending = import("./firestore").then((module) =>
        module.createFirestoreRepository(config),
      );
    }
  }

  return pending;
}

/** Tests swap in a stub; nothing else should call this. */
export function setRepositoryForTesting(repository: PlacesRepository | null): void {
  pending = repository ? Promise.resolve(repository) : null;
}
