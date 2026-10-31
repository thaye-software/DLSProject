import { MongoDBContainer, type StartedMongoDBContainer } from "@testcontainers/mongodb";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { connectToMongo, type Mongo } from "../../src/adapters/mongo/mongo.js";

const STARTUP_TIMEOUT_MS = 120_000;

export type TestMongo = { container: StartedMongoDBContainer; mongo: Mongo; url: string };

// directConnection: the module starts a single-node replica set whose advertised host isn't reachable from outside.
export async function startMongo(): Promise<TestMongo> {
  const container = await new MongoDBContainer("mongo:7").withStartupTimeout(STARTUP_TIMEOUT_MS).start();
  const url = `${container.getConnectionString()}/search?directConnection=true`;
  return { container, mongo: await connectToMongo(url), url };
}

export function startRedis(): Promise<StartedRedisContainer> {
  return new RedisContainer("redis:7-alpine").withStartupTimeout(STARTUP_TIMEOUT_MS).start();
}
