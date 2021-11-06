import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // No manualChunks on purpose: the Firebase SDK is reached only through
  // dynamic imports (src/data/index.ts, authService), so Rollup already splits
  // it out and a manual grouping would pull it back into the initial bundle.
  build: {
    // The one chunk over the default threshold is the Firestore SDK, which is
    // lazily loaded and never fetched on a fixtures build. Raised so a real
    // regression in the entry bundle is not lost among expected noise.
    chunkSizeWarningLimit: 600,
  },
});
