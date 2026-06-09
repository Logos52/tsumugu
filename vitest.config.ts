import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/src/**/*.test.ts",
      "apps/**/src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "packs/private/**/*.test.ts",
    ],
    environment: "node",
  },
});
