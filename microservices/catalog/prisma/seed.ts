import { createDatabase } from "../src/adapters/db/prisma.js";
import { seedCatalog } from "../src/adapters/db/seed.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const database = createDatabase(databaseUrl);
try {
  await seedCatalog(database);
} finally {
  await database.$disconnect();
}
