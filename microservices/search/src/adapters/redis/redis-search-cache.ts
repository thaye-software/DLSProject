import { createClient } from "redis";
import type { SearchCache } from "../../application/ports/search-cache.js";
import type { Listing, SearchResult } from "../../domain/listing.js";

// A safety net behind the generation counter: results a bump didn't invalidate (a lost bump) still expire.
const RESULT_TTL_SECONDS = 60;
const GENERATION_KEY = "search:generation";
const START_WAIT_MS = 3000;

export type RedisCache = SearchCache & { close: () => Promise<void> };

export async function connectToRedis(url: string): Promise<RedisCache> {
  const client = createClient({
    url,
    // Commands fail at once while Redis is down instead of queueing until it is back, so a search falls
    // through to MongoDB instead of hanging.
    disableOfflineQueue: true,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 5000), connectTimeout: 2000 },
  });
  // node-redis throws on an 'error' event nobody listens for; connection trouble is logged, not fatal.
  client.on("error", (error) => console.error("Redis error", error.message));
  // With a reconnect strategy connect() never fails, it keeps trying; waiting for it would hold up the whole service
  // while Redis is down. Wait a moment, then start without a cache; it takes over by itself once Redis answers.
  const connecting = client.connect().catch((error) => console.error("Redis connection failed", error.message));
  await Promise.race([connecting, new Promise((resolve) => setTimeout(resolve, START_WAIT_MS))]);

  return {
    generation: async () => Number((await client.get(GENERATION_KEY)) ?? 0),
    get: async (key) => {
      const text = await client.get(key);
      return text === null ? null : parse(text);
    },
    set: async (key, result) => {
      await client.set(key, JSON.stringify(result), { EX: RESULT_TTL_SECONDS });
    },
    bump: async () => {
      await client.incr(GENERATION_KEY);
    },
    close: async () => {
      if (client.isOpen) await client.close();
    },
  };
}

// JSON turns the Dates into strings.
function parse(text: string): SearchResult {
  const result = JSON.parse(text) as { items: (Omit<Listing, "updatedAt"> & { updatedAt: string })[]; total: number };
  return { total: result.total, items: result.items.map((item) => ({ ...item, updatedAt: new Date(item.updatedAt) })) };
}

// Used when REDIS_URL is not set: every search reads MongoDB.
export const noCache: SearchCache = {
  generation: async () => 0,
  get: async () => null,
  set: async () => undefined,
  bump: async () => undefined,
};
