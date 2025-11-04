import { defineConfig } from "drizzle-kit";
import './envConfig.ts';

const connectionString = process.env.APP_ENV == 'prod' 
  ? process.env.DATABASE_URL_PROD
  : process.env.APP_ENV == 'dev'
  ? process.env.DATABASE_URL_DEV
  : process.env.DATABASE_URL_LOCAL; 

export default defineConfig({
  out: "./src/database/migrations",
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  dbCredentials: {
    url: connectionString!,
  },
});