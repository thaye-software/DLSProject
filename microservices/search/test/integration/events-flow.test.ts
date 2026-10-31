import { randomUUID } from "node:crypto";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import type { StartedRedisContainer } from "@testcontainers/redis";
import { connect, type Channel, type ChannelModel } from "amqplib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoInbox } from "../../src/adapters/mongo/mongo-inbox.js";
import { MongoListingStore } from "../../src/adapters/mongo/mongo-listing-store.js";
import { CATALOG_EVENTS_EXCHANGE, CATALOG_EVENTS_QUEUE, createCatalogEventHandlers } from "../../src/adapters/rabbitmq/catalog-events.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { startConsumer, type Consumer } from "../../src/adapters/rabbitmq/consumer.js";
import { assertConsumerTopology } from "../../src/adapters/rabbitmq/topology.js";
import { connectToRedis, type RedisCache } from "../../src/adapters/redis/redis-search-cache.js";
import { searchListings } from "../../src/application/search-listings.js";
import type { SearchQuery } from "../../src/domain/listing.js";
import { asyncApi } from "../support/contract.js";
import { startMongo, startRedis, type TestMongo } from "../support/containers.js";
import { startRabbitMq } from "../support/rabbitmq.js";
import { BRAND_ID, OTHER_PRODUCT_ID, PRODUCT_ID, snapshot } from "../fixtures/products.js";

const BROKER_WAIT = { timeout: 15_000 };
const ALL: SearchQuery["availability"] = ["available", "reserved", "sold"];

let mongo: TestMongo;
let redis: StartedRedisContainer;
let rabbit: StartedRabbitMQContainer;
let cache: RedisCache;
let store: MongoListingStore;
let broker: BrokerConnection;
let consumer: Consumer;
let testConnection: ChannelModel;
let testChannel: Channel;

beforeAll(async () => {
  [mongo, redis, rabbit] = await Promise.all([startMongo(), startRedis(), startRabbitMq()]);
  cache = await connectToRedis(redis.getConnectionUrl());
  store = new MongoListingStore(mongo.mongo.db);
  const inbox = new MongoInbox(mongo.mongo.db);
  await Promise.all([store.ensureIndexes(), inbox.ensureIndexes()]);

  testConnection = await connect(rabbit.getAmqpUrl());
  testChannel = await testConnection.createChannel();

  // Wired as in main.ts, with short retries.
  broker = await connectToBroker(rabbit.getAmqpUrl());
  const handlers = createCatalogEventHandlers({ store, inbox, cache });
  await assertConsumerTopology(broker.channel, { exchange: CATALOG_EVENTS_EXCHANGE, queue: CATALOG_EVENTS_QUEUE, routingKeys: Object.keys(handlers) });
  consumer = await startConsumer(broker.channel, { queue: CATALOG_EVENTS_QUEUE, handlers, retryDelaysMs: [10, 10] });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterAll(async () => {
  await consumer?.stop();
  await broker?.close();
  await testConnection?.close();
  await cache?.close();
  await mongo?.mongo.close();
  await Promise.all([mongo?.container.stop(), redis?.stop(), rabbit?.stop()]);
});

function publish(type: string, data: unknown, id = randomUUID()): string {
  const event = { specversion: "1.0", id, source: "/services/catalog", type, time: new Date().toISOString(), data };
  testChannel.publish(CATALOG_EVENTS_EXCHANGE, type, Buffer.from(JSON.stringify(event)), { persistent: true });
  return id;
}

const created = (productId: string, version: number, overrides: Record<string, unknown> = {}) => ({
  product: { ...snapshot, product_id: productId, version, ...overrides },
  changed_by: "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
});

const availability = (productId: string, version: number, value: string) => ({
  product_id: productId,
  version,
  availability: value,
  previous_availability: "available",
  stock: 0,
  reason: "order_reserved",
  order_id: randomUUID(),
  changed_at: new Date().toISOString(),
});

const search = (overrides: Partial<SearchQuery> = {}) =>
  searchListings({ q: null, brand: null, availability: ALL, minPriceDkk: null, maxPriceDkk: null, page: 1, pageSize: 50, ...overrides }, { store, cache });

const names = async (overrides: Partial<SearchQuery> = {}) => (await search(overrides)).items.map((item) => item.productId);

describe("catalog.events → Search", () => {
  it("indexes a product_created, found by name, reference and brand", async () => {
    const product = randomUUID();
    publish("product_created", created(product, 1, { name: "Zenith El Primero" }));

    await vi.waitFor(async () => expect(await names({ q: "zenith" })).toEqual([product]), BROKER_WAIT);
  });

  it("accepts the contract's example events end to end", async () => {
    const example = asyncApi.components.messages.ProductCreated.examples[0].payload.data;
    publish("product_created", example);

    await vi.waitFor(async () => expect(await names()).toContain(example.product.product_id), BROKER_WAIT);
  });

  it("serves a cached result until an event changes the index, then the fresh one", async () => {
    const product = randomUUID();
    publish("product_created", created(product, 1, { name: "Cache Probe Alpha" }));
    await vi.waitFor(async () => expect(await names({ q: "alpha" })).toEqual([product]), BROKER_WAIT);
    const cachedKeys = async () => cache.generation();
    const generation = await cachedKeys();

    publish("product_updated", { ...created(product, 2, { name: "Cache Probe Alpha", price: { amount_minor: 1_000, currency: "DKK" } }), changed_fields: ["price"] });

    await vi.waitFor(async () => expect((await search({ q: "alpha" })).items[0]?.priceDkk).toBe(1_000), BROKER_WAIT);
    expect(await cachedKeys()).toBeGreaterThan(generation);
  });

  it("changes a listing's availability, and hides it from the default search once it is sold", async () => {
    const product = randomUUID();
    publish("product_created", created(product, 1, { name: "Availability Probe" }));
    await vi.waitFor(async () => expect(await names({ q: "availability probe", availability: ["available"] })).toEqual([product]), BROKER_WAIT);

    publish("product_availability_changed", availability(product, 2, "sold"));

    await vi.waitFor(async () => expect(await names({ q: "availability probe", availability: ["sold"] })).toEqual([product]), BROKER_WAIT);
    expect(await names({ q: "availability probe", availability: ["available"] })).toEqual([]);
  });

  it("acknowledges an availability change for a product it never saw: nothing indexed, nothing dead-lettered", async () => {
    const unknown = randomUUID();

    publish("product_availability_changed", availability(unknown, 2, "reserved"));

    await vi.waitFor(async () => expect((await testChannel.checkQueue(CATALOG_EVENTS_QUEUE)).messageCount).toBe(0), BROKER_WAIT);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await names()).not.toContain(unknown);
    expect((await testChannel.checkQueue(`${CATALOG_EVENTS_QUEUE}.dlq`)).messageCount).toBe(0);
  });

  it("handles a redelivered event id once", async () => {
    const product = randomUUID();
    const eventId = randomUUID();
    publish("product_created", created(product, 1, { name: "Dedupe Probe" }), eventId);
    await vi.waitFor(async () => expect(await names({ q: "dedupe probe" })).toEqual([product]), BROKER_WAIT);

    // Same event id, a different (newer) body: if it were applied the price would change.
    publish("product_updated", { ...created(product, 9, { name: "Dedupe Probe", price: { amount_minor: 1, currency: "DKK" } }), changed_fields: ["price"] }, eventId);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect((await search({ q: "dedupe probe" })).items[0]?.priceDkk).toBe(11_500_000);
  });

  it("ignores an older update that arrives after a newer one", async () => {
    const product = randomUUID();
    publish("product_created", created(product, 5, { name: "Order Probe", price: { amount_minor: 500, currency: "DKK" } }));
    await vi.waitFor(async () => expect(await names({ q: "order probe" })).toEqual([product]), BROKER_WAIT);

    publish("product_updated", { ...created(product, 4, { name: "Order Probe", price: { amount_minor: 400, currency: "DKK" } }), changed_fields: ["price"] });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect((await search({ q: "order probe" })).items[0]?.priceDkk).toBe(500);
  });

  it("removes a deleted product and keeps an older update from bringing it back", async () => {
    const product = randomUUID();
    publish("product_created", created(product, 1, { name: "Delete Probe" }));
    await vi.waitFor(async () => expect(await names({ q: "delete probe" })).toEqual([product]), BROKER_WAIT);

    publish("product_deleted", { product_id: product, version: 2, deleted_by: randomUUID(), deleted_at: new Date().toISOString() });
    await vi.waitFor(async () => expect(await names({ q: "delete probe" })).toEqual([]), BROKER_WAIT);

    publish("product_updated", { ...created(product, 1, { name: "Delete Probe" }), changed_fields: ["name"] });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await names({ q: "delete probe" })).toEqual([]);
  });

  it("renames a brand on its listings", async () => {
    const product = randomUUID();
    publish("product_created", created(product, 1, { name: "Brand Probe", watch: { ...snapshot.watch, brand: { brand_id: BRAND_ID, name: "Rolex", slug: "rolex" } } }));
    await vi.waitFor(async () => expect(await names({ q: "brand probe" })).toEqual([product]), BROKER_WAIT);

    publish("brand_updated", { brand: { brand_id: BRAND_ID, name: "Rolex SA", slug: "rolex-sa" }, version: 2, changed_by: randomUUID(), changed_at: new Date().toISOString() });

    await vi.waitFor(async () => expect((await search({ q: "brand probe" })).items[0]?.brandName).toBe("Rolex SA"), BROKER_WAIT);
    expect(await names({ brand: "rolex-sa", q: "brand probe" })).toEqual([product]);
  });

  it("dead-letters an event whose data doesn't match its type", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    publish("product_created", created(OTHER_PRODUCT_ID, 1, { price: { amount_minor: 1, currency: "EUR" } }));

    await vi.waitFor(async () => expect((await testChannel.checkQueue(`${CATALOG_EVENTS_QUEUE}.dlq`)).messageCount).toBe(1), BROKER_WAIT);
  });
});
