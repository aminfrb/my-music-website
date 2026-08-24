import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // tsconfig sets `jsx: "preserve"` because Next owns the transform in the app
  // build; under Vitest nothing else will do it, so esbuild uses the automatic
  // runtime here.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      // Mirrors the `@/*` path alias in tsconfig.json.
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.tsx"],
    globals: false,
    restoreMocks: true,
  },
});
