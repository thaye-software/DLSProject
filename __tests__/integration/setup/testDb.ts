import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/database/schema";
import { sql, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

const connectionString =
  process.env.DATABASE_URL_TEST ||
  process.env.DATABASE_URL_LOCAL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let client: postgres.Sql;
let db: ReturnType<typeof drizzle<typeof schema>>;

export async function setupTestDatabase() {
  if (!client) {
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
