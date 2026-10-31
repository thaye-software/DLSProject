import { MongoClient, type Db } from "mongodb";

export type Mongo = {
  db: Db;
  isReachable: () => Promise<boolean>;
  close: () => Promise<void>;
};

export async function connectToMongo(url: string): Promise<Mongo> {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  // The database name comes from the URL path (mongodb://host/search).
  const db = client.db();

  return {
    db,
    isReachable: async () => {
      try {
        await db.command({ ping: 1 });
        return true;
      } catch {
        return false;
      }
    },
    close: () => client.close(),
  };
}
