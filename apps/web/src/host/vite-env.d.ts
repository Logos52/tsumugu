/// <reference types="vite/client" />

// sql.js ships its wasm as an asset; `?url` resolves to the emitted asset URL.
// vite/client already declares "*?url", but declaring the wasm-specific form
// keeps tsc happy if the glob isn't picked up in this app's config.
declare module "*.wasm?url" {
  const url: string;
  export default url;
}
