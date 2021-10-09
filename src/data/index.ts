import { firebaseConfig } from "../config";
import type { PlacesRepository } from "./repository";

let pending: Promise<PlacesRepository> | null = null;

/**
 * Picks the adapter once per session. Both are dynamically imported so the
 * Firebase SDK never reaches the bundle of someone running on fixtures.
 */
export function getRepository(): Promise<PlacesRepository> {
  // Bound to a local so the null check still holds inside the callback.
  const config = firebaseConfig;

  pending ??= config
    ? import("./firestore").then((module) => module.createFirestoreRepository(config))
    : import("./fixtures").then((module) => module.createFixtureRepository());

  return pending;
}

/** Tests swap in a stub; nothing else should call this. */
export function setRepositoryForTesting(repository: PlacesRepository | null): void {
  pending = repository ? Promise.resolve(repository) : null;
}
