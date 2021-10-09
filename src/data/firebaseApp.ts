import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import type { FirebaseConfig } from "../config";

const APP_NAME = "waypoint";

/** initializeApp throws on a duplicate name, which HMR triggers constantly. */
export function firebaseApp(config: FirebaseConfig): FirebaseApp {
  const existing = getApps().find((app) => app.name === APP_NAME);
  return existing ? getApp(APP_NAME) : initializeApp(config, APP_NAME);
}
