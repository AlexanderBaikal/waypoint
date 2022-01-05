export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
}

const env = import.meta.env;

/** Treats an unset variable and an empty one as the same thing. */
const value = (raw: string | undefined): string | null => {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed;
};

/**
 * Firebase is optional. Without a complete config the app falls back to the
 * bundled fixtures, which is what `npm run dev` does on a fresh clone.
 *
 * The web API key is a public client identifier — access is decided by
 * firestore.rules. It lives in .env only so the repository is not tied to one
 * Firebase project.
 */
function readFirebaseConfig(): FirebaseConfig | null {
  const config = {
    apiKey: value(env.VITE_FIREBASE_API_KEY),
    authDomain: value(env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: value(env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: value(env.VITE_FIREBASE_STORAGE_BUCKET),
    appId: value(env.VITE_FIREBASE_APP_ID),
  };

  const missing = Object.entries(config)
    .filter(([, entry]) => entry === null)
    .map(([key]) => key);

  if (missing.length === Object.keys(config).length) return null;

  if (missing.length > 0) {
    // Half-configured is almost always a typo in .env, and silently dropping
    // to fixtures would hide it.
    console.warn(
      `Ignoring partial Firebase config; missing: ${missing.join(", ")}. Using fixtures.`,
    );
    return null;
  }

  return config as FirebaseConfig;
}

export const firebaseConfig = readFirebaseConfig();

export type Basemap = "light" | "dark";

/**
 * CARTO Positron and Dark Matter: no API key, and both are muted enough to
 * leave the category colours to the markers instead of competing with them.
 * They are the same cartography in two values, so switching between them moves
 * nothing on the map but its brightness.
 */
export const tiles = {
  light:
    value(env.VITE_TILE_URL) ??
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark:
    value(env.VITE_TILE_URL_DARK) ??
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    value(env.VITE_TILE_ATTRIBUTION) ??
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
};

/** Irkutsk — where the sample dataset lives. */
export const INITIAL_VIEW = { center: { lat: 52.278, lng: 104.295 }, zoom: 13 };
