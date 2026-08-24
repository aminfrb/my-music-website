import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration specs each own a database and drop collections between
    // cases, so they must not run concurrently against the same server.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    setupFiles: ["tests/setup.ts"],
    globals: false,
  },
});
