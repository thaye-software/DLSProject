import { defineConfig } from "vitest/config";

const JOURNEY_TIMEOUT_MS = 60_000;

export default defineConfig({
  test: {
    include: ["test/journeys/**/*.test.ts"],
    globalSetup: ["test/support/wait-for-stack.ts"],
    testTimeout: JOURNEY_TIMEOUT_MS,
    hookTimeout: JOURNEY_TIMEOUT_MS,
  },
});
