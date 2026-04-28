import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Use explicit `resolve.alias` for `@/*` — `vite-tsconfig-paths` breaks Vitest 3
 * (namespace import from `vitest` becomes `{}`, so `describe` / `vi` are undefined).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "tests/**/*.test.mjs"],
    clearMocks: true,
    restoreMocks: true,
  },
});
