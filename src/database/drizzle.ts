import "../../envConfig.ts";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { seed } from "drizzle-seed";

const connectionString =
  process.env.APP_ENV == "prod"
    ? process.env.DATABASE_URL_PROD
    : process.env.APP_ENV == "dev"
    ? process.env.DATABASE_URL_DEV
    : process.env.DATABASE_URL_LOCAL;

console.log("Database connection string:", connectionString);
console.log("Database connection string:", process.env.APP_ENV);
if (!connectionString) {
  throw new Error(
    "the database connection string is not set in environment variables"
  );
}

// In serverless / hot-reload environments creating a new postgres client for
// every module load can exhaust Postgres connection slots. Cache the client on
// globalThis so we reuse a single instance during the process lifetime.
const globalForPostgres = globalThis as unknown as {
  __postgres_client__?: ReturnType<typeof postgres>;
};

if (!globalForPostgres.__postgres_client__) {
  // You can tune pool options here (max connections, idle timeout, etc.) if
  // your `postgres` client/driver supports them. In production it's better to
  // use a pooled proxy like PgBouncer.
  globalForPostgres.__postgres_client__ = postgres(connectionString, {
    prepare: false,
  });
}

export const client = globalForPostgres.__postgres_client__!;
export const db = drizzle({ client, schema });

// async function runSeed() {
//   console.log("Seeding database...");
//   await seed(db, schema);
//   console.log("Database seeded.");
// }
// runSeed().catch((error) => {
//   console.error("Error seeding database:", error);
// });
