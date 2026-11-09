import { defineConfig } from "vitest/config";

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
    ],
  },
});
