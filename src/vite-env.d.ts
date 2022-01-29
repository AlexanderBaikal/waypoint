/// <reference types="vite/client" />

// Declaring the variables we actually read turns `import.meta.env.X` from `any`
// into `string | undefined`, so a typo in a variable name is a type error.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_SCHEMA?: string;
  readonly VITE_TILE_URL?: string;
  readonly VITE_TILE_URL_DARK?: string;
  readonly VITE_TILE_ATTRIBUTION?: string;
  readonly VITE_TILE_ATTRIBUTION_DARK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
