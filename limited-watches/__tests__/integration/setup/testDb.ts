import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/database/schema";
import { sql, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { execSync } from "child_process";

// Prefer an explicit test DB URL. If running tests, require DATABASE_URL_TEST
const connectionStringEnv =
  process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL_LOCAL;

const defaultLocalConnection =
  "postgresql://postgres:postgres@127.0.0.1:54421/postgres";
const connectionString = connectionStringEnv ?? defaultLocalConnection;

// Detect if we appear to be running under a test environment
const isJest = typeof process.env.JEST_WORKER_ID !== "undefined";
const isNodeEnvTest = process.env.NODE_ENV === "test";
const isTestRun = isJest || isNodeEnvTest;

// If we're running tests, require a dedicated test database URL to be set.
// This prevents accidental use of a developer database for destructive operations (truncate).
if (isTestRun && !process.env.DATABASE_URL_TEST) {
  throw new Error(
    "Refusing to run tests without a dedicated test database.\nSet the DATABASE_URL_TEST environment variable to a test database (not your development database)."
  );
}

// Parse the database name for further safety checks.
let parsedDbName = "";
try {
  const parsed = new URL(connectionString);
  parsedDbName = parsed.pathname?.replace(/^\//, "") ?? "";
} catch (err) {
  // If parsing fails, be conservative: require explicit DATABASE_URL_TEST
  if (isTestRun) {
    throw new Error(
      "Unable to parse database name from the connection string. Provide a DATABASE_URL_TEST that points to a test DB."
    );
  }
}

let client: postgres.Sql;
let db: ReturnType<typeof drizzle<typeof schema>>;

export async function setupTestDatabase() {
  if (!client) {
    // If we are running tests, and a DATABASE_URL_TEST was provided, prefer it (already used above).
    client = postgres(connectionString, { max: 1 });
    db = drizzle(client, { schema });
  }
  return { db, client };
}

export async function teardownTestDatabase() {
  if (client) {
    await client.end();
    // @ts-ignore
    client = undefined;
    // @ts-ignore
    db = undefined;
  }
}

export async function cleanDatabase() {
  if (!db) {
    const setup = await setupTestDatabase();
    db = setup.db;
  }

  const tableNames = Object.values(schema)
    .filter((value) => value instanceof PgTable)
    .map((table) => getTableName(table as PgTable));

  if (tableNames.length === 0) return;

  // Safety check: only allow destructive cleanup if this is a test DB
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error(
      "Aborting cleanDatabase(): No DATABASE_URL_TEST set. Refusing to truncate tables on a non-test database."
    );
  }

  if (isTestRun) {
    // ensure the DB looks like a test DB
    if (!parsedDbName) {
      throw new Error(
        "Aborting cleanDatabase(): Could not determine target database name. Provide a proper DATABASE_URL_TEST pointing to a test DB."
      );
    }
  }

  // Use TRUNCATE with CASCADE to clean all tables
  // We wrap table names in quotes to handle case sensitivity and reserved keywords
  const truncateQuery = sql.raw(
    `TRUNCATE TABLE ${tableNames
      .map((name) => `"${name}"`)
      .join(", ")} CASCADE;`
  );

  await db.execute(truncateQuery);
}

export async function disableForeignKeys() {
  if (!db) return;
  await db.execute(sql`SET session_replication_role = 'replica';`);
}

export async function enableForeignKeys() {
  if (!db) return;
  await db.execute(sql`SET session_replication_role = 'origin';`);
}
