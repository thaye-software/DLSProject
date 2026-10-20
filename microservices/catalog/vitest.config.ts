import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { TZ: "UTC" },
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
