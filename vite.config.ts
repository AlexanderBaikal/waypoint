import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // No manualChunks on purpose: the Firebase SDK is reached only through
  // dynamic imports (src/data/index.ts, authService), so Rollup already splits
  // it out and a manual grouping would pull it back into the initial bundle.
  build: {
    // Two chunks sit over the default threshold, both lazily loaded and only
    // one of them ever fetched: the Firestore SDK on a configured build, the
    // fixture dataset otherwise. The fixture is ~1.2 MB of JSON that gzips to
    // under 100 kB. Raised so a real regression in the entry bundle is not lost
    // among expected noise.
    chunkSizeWarningLimit: 1300,
  },
});
