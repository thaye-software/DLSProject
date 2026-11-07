import { MongoDBContainer, type StartedMongoDBContainer } from "@testcontainers/mongodb";
import { connectToMongo, type Mongo } from "../../src/adapters/mongo/mongo.js";

const STARTUP_TIMEOUT_MS = 120_000;

export type TestMongo = { container: StartedMongoDBContainer; mongo: Mongo; url: string };

export async function startMongo(): Promise<TestMongo> {
  const container = await new MongoDBContainer("mongo:7").withStartupTimeout(STARTUP_TIMEOUT_MS).start();
  const url = `${container.getConnectionString()}/messaging?directConnection=true`;
  return { container, mongo: await connectToMongo(url), url };
}
