import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

export type Database = PrismaClient;

export function createDatabase(url: string): Database {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function isDatabaseReachable(database: Database): Promise<boolean> {
  try {
    await database.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
