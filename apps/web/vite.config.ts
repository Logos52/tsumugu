import { defineConfig } from "vite";

// Client-side only; no backend. sql.js wasm is loaded via a ?url import in the
// Anki host adapter, so no special config is needed here.
export default defineConfig({
  root: ".",
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    // sql.js ships a wasm + CJS glue; let Vite prebundle it cleanly.
    exclude: ["@tsumugu/engine", "@tsumugu/demo-pack"],
  },
});
