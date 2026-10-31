import type { StartedRedisContainer } from "@testcontainers/redis";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connectToRedis, type RedisCache } from "../../src/adapters/redis/redis-search-cache.js";
import { cacheKey } from "../../src/application/search-listings.js";
import type { SearchQuery, SearchResult } from "../../src/domain/listing.js";
import { listing } from "../fixtures/products.js";
import { startRedis } from "../support/containers.js";

const query: SearchQuery = { q: null, brand: null, availability: ["available"], minPriceDkk: null, maxPriceDkk: null, page: 1, pageSize: 20 };
const result: SearchResult = { items: [listing()], total: 1 };

let container: StartedRedisContainer;
let cache: RedisCache;

beforeAll(async () => {
  container = await startRedis();
  cache = await connectToRedis(container.getConnectionUrl());
});

afterAll(async () => {
  await cache?.close();
  await container?.stop();
});

describe("redis search cache", () => {
  it("stores a result and gives it back with its dates as Dates", async () => {
    const key = cacheKey(0, query);

    await cache.set(key, result);

    await expect(cache.get(key)).resolves.toEqual(result);
  });

  it("returns null for a key it doesn't have", async () => {
    await expect(cache.get("search:0:nothing")).resolves.toBeNull();
  });

  it("expires a result after 60 seconds as a safety net", async () => {
    const key = cacheKey(1, query);
    await cache.set(key, result);
    const raw = createClient({ url: container.getConnectionUrl() });
    await raw.connect();
    try {
      const ttl = await raw.ttl(key);

      expect(ttl).toBeGreaterThan(55);
      expect(ttl).toBeLessThanOrEqual(60);
    } finally {
      await raw.close();
    }
  });

  it("every bump makes the old results unreachable", async () => {
    // Its own query, so the keys of the other tests can't be the ones found.
    const own = { ...query, q: "bump test" };
    const before = await cache.generation();
    await cache.set(cacheKey(before, own), result);

    await cache.bump();
    const after = await cache.generation();

    expect(after).toBe(before + 1);
    await expect(cache.get(cacheKey(after, own))).resolves.toBeNull();
    await expect(cache.get(cacheKey(before, own))).resolves.toEqual(result);
  });
});

describe("redis search cache without Redis", () => {
  it("starts within a few seconds anyway, and then fails each call at once instead of queueing it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const started = Date.now();

    const down = await connectToRedis("redis://127.0.0.1:1");

    expect(Date.now() - started).toBeLessThan(6000);
    const call = Date.now();
    await expect(down.generation()).rejects.toThrow();
    await expect(down.get("key")).rejects.toThrow();
    await expect(down.bump()).rejects.toThrow();
    expect(Date.now() - call).toBeLessThan(1000);
    await down.close();
  }, 15_000);
});
