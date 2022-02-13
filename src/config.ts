export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
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
 * Firebase is optional: without a complete config the app falls back to the
 * bundled fixtures, which is what `npm run dev` does on a fresh clone.
 *
 * The web API key is a public client identifier; access is decided by
 * firestore.rules. It lives in .env only so the repository is not tied to one
 * Firebase project.
 *
 * There is no storage bucket among these fields. Photographs are links to
 * images already on the web, so nothing here talks to Cloud Storage.
 */
function readFirebaseConfig(): FirebaseConfig | null {
  const config = {
    apiKey: value(env.VITE_FIREBASE_API_KEY),
    authDomain: value(env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: value(env.VITE_FIREBASE_PROJECT_ID),
    appId: value(env.VITE_FIREBASE_APP_ID),
  };

  const missing = Object.entries(config)
    .filter(([, entry]) => entry === null)
    .map(([key]) => key);

  if (missing.length === Object.keys(config).length) return null;

  if (missing.length > 0) {
    // Half-configured is almost always a typo in .env, and dropping silently
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
 * Which Firestore shape to read. `legacy` is the inherited 2021 database:
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
  /**
   * The deepest zoom the provider actually has tiles for, where that is
   * shallower than the map's maximum. Past it Leaflet stretches the last real
   * level instead of requesting tiles that do not exist.
   */
  maxNativeZoom?: number;
  /** Whether the provider serves a 2x tile for the same URL. */
  retina: boolean;
  /**
   * Set together, and only for a provider whose tile is not the 256px square
   * Leaflet assumes. A 512px tile covers the ground of four of them, so the
   * layer has to request one zoom level shallower.
   */
  tileSize?: number;
  zoomOffset?: number;
}

const OSM_CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * MapTiler's key: a client identifier rather than a secret, since it ships in
 * every tile URL the browser requests. It is metered, so restrict it by origin
 * in the MapTiler console.
 */
const maptilerKey = value(env.VITE_MAPTILER_KEY);

/**
 * MapTiler Streets, in light and dark cuts of the same cartography.
 *
 * Its raster tiles are 512px, hence the pair of options: `tileSize` tells
 * Leaflet how much screen one tile covers and `zoomOffset` corrects which tile
 * that is. `@2x` doubles the pixels inside that tile rather than changing which
 * one it is, so `detectRetina` stays off.
 */
function maptiler(style: string, key: string): TileSource {
  return {
    url: `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}@2x.png?key=${key}`,
    attribution: `&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ${OSM_CREDIT}`,
    tileSize: 512,
    zoomOffset: -1,
    retina: false,
  };
}

/** A basemap named in .env wins over both of the sources below. */
function override(url?: string, attribution?: string): TileSource | null {
  const template = value(url);
  if (!template) return null;
  return { url: template, attribution: value(attribution) ?? OSM_CREDIT, retina: false };
}

/**
 * The keyless pair, so a fresh clone still gets a map: CARTO Voyager and Esri
 * Dark Gray Canvas. Voyager is the closest free basemap to a street map with
 * colour in it; Dark Gray Canvas is a mid grey with legible streets, unlike
 * CARTO's near-black Dark Matter.
 *
 * Dark Gray Canvas's cache stops at zoom 16 over this city. The service
 * advertises levels to 23 and answers a deeper request with a "Map data not yet
 * available" tile, so the real depth is declared rather than trusted.
 */
const KEYLESS: Record<Theme, TileSource> = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: `${OSM_CREDIT}, &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    retina: true,
  },
  dark: {
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: `Esri, HERE, Garmin, ${OSM_CREDIT}`,
    maxNativeZoom: 16,
    retina: false,
  },
};

export const tiles: Record<Theme, TileSource> = {
  light:
    override(env.VITE_TILE_URL, env.VITE_TILE_ATTRIBUTION) ??
    (maptilerKey ? maptiler("streets-v2", maptilerKey) : KEYLESS.light),
  dark:
    override(env.VITE_TILE_URL_DARK, env.VITE_TILE_ATTRIBUTION_DARK) ??
    (maptilerKey ? maptiler("streets-v2-dark", maptilerKey) : KEYLESS.dark),
};

/** Shared by both sources; `subdomains` is unused by a URL with no {s}. */
export const tileOptions = { subdomains: "abcd", maxZoom: 19 };

/** Irkutsk, where the sample dataset lives. */
export const INITIAL_VIEW = { center: { lat: 52.278, lng: 104.295 }, zoom: 13 };
