import '../../envConfig.ts';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.APP_ENV == 'prod' 
  ? process.env.DATABASE_URL_PROD
  : process.env.APP_ENV == 'dev'
  ? process.env.DATABASE_URL_DEV
  : process.env.DATABASE_URL_LOCAL; 

  console.log("Database connection string:", connectionString);
  console.log("Database connection string:", process.env.APP_ENV);
if (!connectionString) {
  throw new Error("the database connection string is not set in environment variables");
}

export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);
