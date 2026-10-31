import { describe, expect, it, vi } from "vitest";
import type { SearchCache } from "../../src/application/ports/search-cache.js";
import { cacheKey, searchListings } from "../../src/application/search-listings.js";
import type { SearchQuery, SearchResult } from "../../src/domain/listing.js";
import { listing } from "../fixtures/products.js";

const query: SearchQuery = { q: "rolex", brand: null, availability: ["available"], minPriceDkk: null, maxPriceDkk: null, page: 1, pageSize: 20 };
const result: SearchResult = { items: [listing()], total: 1 };

function setup(cacheOverrides: Partial<SearchCache> = {}) {
  const calls: string[] = [];
  const store = {
    search: vi.fn(async () => {
      calls.push("search");
      return result;
    }),
  };
  const cache: SearchCache = {
    generation: vi.fn(async () => {
      calls.push("generation");
      return 4;
    }),
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    bump: vi.fn(async () => undefined),
    ...cacheOverrides,
  };
  return { store, cache, calls };
}

describe("cacheKey", () => {
  it("is the same for the same query whatever order the availabilities come in", () => {
    const a = cacheKey(4, { ...query, availability: ["sold", "available"] });
    const b = cacheKey(4, { ...query, availability: ["available", "sold"] });

    expect(a).toBe(b);
  });

  it.each([
    { name: "another generation", other: () => cacheKey(5, query) },
    { name: "another q", other: () => cacheKey(4, { ...query, q: "omega" }) },
    { name: "another page", other: () => cacheKey(4, { ...query, page: 2 }) },
    { name: "another price", other: () => cacheKey(4, { ...query, maxPriceDkk: 100 }) },
    { name: "another availability", other: () => cacheKey(4, { ...query, availability: ["sold"] }) },
  ])("differs for $name", ({ other }) => {
    expect(other()).not.toBe(cacheKey(4, query));
  });
});

describe("searchListings", () => {
  it("answers from the cache without touching MongoDB on a hit", async () => {
    const { store, cache } = setup({ get: vi.fn(async () => result) });

    await expect(searchListings(query, { store, cache })).resolves.toEqual(result);
    expect(store.search).not.toHaveBeenCalled();
  });

  it("reads MongoDB on a miss and caches the result under the key of the generation read first", async () => {
    const { store, cache, calls } = setup();

    await expect(searchListings(query, { store, cache })).resolves.toEqual(result);

    expect(calls).toEqual(["generation", "search"]);
    expect(cache.set).toHaveBeenCalledWith(cacheKey(4, query), result);
  });

  it.each([
    { name: "generation() fails", overrides: { generation: vi.fn(async () => Promise.reject(new Error("redis down"))) } },
    { name: "get() fails", overrides: { get: vi.fn(async () => Promise.reject(new Error("redis down"))) } },
  ])("falls back to MongoDB when $name", async ({ overrides }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { store, cache } = setup(overrides);

    await expect(searchListings(query, { store, cache })).resolves.toEqual(result);
    expect(store.search).toHaveBeenCalledTimes(1);
  });

  it("still answers when the result can't be cached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { store, cache } = setup({ set: vi.fn(async () => Promise.reject(new Error("redis down"))) });

    await expect(searchListings(query, { store, cache })).resolves.toEqual(result);
  });

  it("does not hide a MongoDB failure", async () => {
    const { cache } = setup();
    const store = { search: vi.fn(async () => Promise.reject(new Error("mongo down"))) };

    await expect(searchListings(query, { store, cache })).rejects.toThrow("mongo down");
  });
});
