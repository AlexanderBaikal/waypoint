import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // No manualChunks on purpose: the Firebase SDK is reached only through
  // dynamic imports (src/data/index.ts, authService), so Rollup already splits
  // it out and a manual grouping would pull it back into the initial bundle.
  build: {
    // Raised just past the one chunk that exceeds the default: the Firestore
    // SDK, which is lazily imported and fetched only by a configured build.
    // Anything else crossing this line is a real regression.
    chunkSizeWarningLimit: 600,
  },
});
