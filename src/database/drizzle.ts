import '../../envConfig.ts';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.NODE_ENV == 'production' 
  ? process.env.DATABASE_URL_PROD
  : process.env.NODE_ENV == 'development'
  ? process.env.DATABASE_URL_DEV
  : process.env.DATABASE_URL_LOCAL; 

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);
