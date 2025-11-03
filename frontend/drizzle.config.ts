import { defineConfig } from "drizzle-kit";
import './envConfig.ts';

export default defineConfig({
  out: "./src/database/migrations",
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});