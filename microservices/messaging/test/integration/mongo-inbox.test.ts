import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoInbox } from "../../src/adapters/mongo/mongo-inbox.js";
import { startMongo, type TestMongo } from "../support/containers.js";

let test: TestMongo;
let inbox: MongoInbox;

beforeAll(async () => {
  test = await startMongo();
  inbox = new MongoInbox(test.mongo.db);
  await inbox.ensureIndexes();
});

afterAll(async () => {
  await test?.mongo?.close();
  await test?.container?.stop();
});

describe("MongoInbox", () => {
  it("remembers a recorded event id and nothing else", async () => {
    await expect(inbox.has("event-1")).resolves.toBe(false);

    await inbox.record("event-1", "product_created");

    await expect(inbox.has("event-1")).resolves.toBe(true);
    await expect(inbox.has("event-2")).resolves.toBe(false);
  });

  it("can record the same id twice without an error", async () => {
    await inbox.record("event-3", "brand_updated");

    await expect(inbox.record("event-3", "brand_updated")).resolves.toBeUndefined();
    expect(await test.mongo.db.collection("processed_events").countDocuments({ _id: "event-3" as never })).toBe(1);
  });

  it("lets old ids expire: processed_at has a 14 day TTL index", async () => {
    const indexes = await test.mongo.db.collection("processed_events").indexes();

    expect(indexes).toContainEqual(expect.objectContaining({ name: "processed_at_ttl", expireAfterSeconds: 14 * 24 * 60 * 60 }));
  });
});
