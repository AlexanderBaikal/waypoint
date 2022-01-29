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

/**
 * Which Firestore shape to read. `legacy` is the inherited 2021 database —
 * places split across two collections, reviews joined by storage folder name,
 * no writes. Anything else means the schema this project seeds for itself.
 */
export const firebaseSchema: "legacy" | "v2" =
  value(env.VITE_FIREBASE_SCHEMA) === "legacy" ? "legacy" : "v2";

export type Theme = "light" | "dark";

export interface TileSource {
  url: string;
  /** Each provider states its own terms, so this travels with the URL. */
  attribution: string;
}

/**
 * Light is CARTO Positron. Dark is Esri's Dark Gray Canvas rather than CARTO's
 * own Dark Matter, which was the obvious pairing and the wrong one: Dark Matter
 * is drawn for data overlays, so it is near-black and its streets are a shade
 * off the background — legible as a backdrop for a heatmap, not as a map you
 * read. Dark Gray Canvas sits at a mid grey with light streets, and you can
 * follow a road across it. Both are keyless, and this one goes to zoom 23, so
 * nothing is given up for it.
 *
 * The two are different cartography by different cartographers, which is the
 * cost of the swap — street classes and label density do not match exactly
 * between them. Reading the map beats matching it.
 */
export const tiles: Record<Theme, TileSource> = {
  light: {
    url:
      value(env.VITE_TILE_URL) ??
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      value(env.VITE_TILE_ATTRIBUTION) ??
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url:
      value(env.VITE_TILE_URL_DARK) ??
      "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      value(env.VITE_TILE_ATTRIBUTION_DARK) ??
      'Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

/** Shared by both sources; `subdomains` is simply unused by a URL with no {s}. */
export const tileOptions = { subdomains: "abcd", maxZoom: 19 };

/** Irkutsk — where the sample dataset lives. */
export const INITIAL_VIEW = { center: { lat: 52.278, lng: 104.295 }, zoom: 13 };
