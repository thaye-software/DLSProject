import { defineConfig } from "vitest/config";

const containerStartupMs = 120_000;

export default defineConfig({
  test: {
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          testTimeout: containerStartupMs,
          hookTimeout: containerStartupMs,
        },
      },
    ],
  },
});
