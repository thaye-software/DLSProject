import { describe, expect, it, vi } from "vitest";
import type { AppDependencies } from "../../src/adapters/http/app.js";
import { contractSchema, openApi } from "../support/contract.js";
import { serve } from "../support/serve.js";
import { listing } from "../fixtures/products.js";

async function get(path: string, dependencies: Partial<AppDependencies> = {}) {
  const baseUrl = await serve(dependencies);
  const response = await fetch(`${baseUrl}${path}`);
  return { response, json: await response.json() };
}

describe("GET /search", () => {
  it("answers 200 with SearchResults that match the contract", async () => {
    const search = vi.fn(async () => ({ items: [listing(), listing({ productId: "0c5e1f2a-3b4d-4e6f-8a9b-1c2d3e4f5a6b", brandId: null, brandName: null, brandSlug: null, model: null, reference: null, year: null, sizeMm: null, condition: null, limited: null, thumbnailUrl: null })], total: 2 }));

    const { response, json } = await get("/search?q=rolex", { search });

    expect(response.status).toBe(200);
    const validate = contractSchema("SearchResults");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(json).toMatchObject({ page: 1, page_size: 20, total: 2 });
  });

  it("returns the contract's example listing", async () => {
    const example = openApi.paths["/search"].get.responses["200"].content["application/json"].example.items[0];

    const { json } = await get("/search", { search: async () => ({ items: [listing()], total: 1 }) });

    expect(json.items[0]).toEqual(example);
  });

  it.each([
    { name: "no parameters → defaults", query: "", expected: { q: null, brand: null, availability: ["available"], minPriceDkk: null, maxPriceDkk: null, page: 1, pageSize: 20 } },
    { name: "q trimmed", query: "?q=%20rolex%20", expected: { q: "rolex" } },
    { name: "an empty q means no text filter", query: "?q=", expected: { q: null } },
    { name: "brand slug", query: "?brand=rolex", expected: { brand: "rolex" } },
    { name: "one availability", query: "?availability=sold", expected: { availability: ["sold"] } },
    { name: "a repeated availability", query: "?availability=available&availability=reserved", expected: { availability: ["available", "reserved"] } },
    { name: "price range in øre", query: "?min_price=100&max_price=200", expected: { minPriceDkk: 100, maxPriceDkk: 200 } },
    { name: "min_price = max_price (boundary)", query: "?min_price=150&max_price=150", expected: { minPriceDkk: 150, maxPriceDkk: 150 } },
    { name: "page and page_size 100 (boundary)", query: "?page=3&page_size=100", expected: { page: 3, pageSize: 100 } },
    { name: "a 200 character q (boundary)", query: `?q=${"a".repeat(200)}`, expected: { q: "a".repeat(200) } },
  ])("passes $name to the search", async ({ query, expected }) => {
    const search = vi.fn(async () => ({ items: [], total: 0 }));

    await get(`/search${query}`, { search });

    expect(search).toHaveBeenCalledWith(expect.objectContaining(expected));
  });

  it.each([
    { name: "hidden availability", query: "?availability=hidden" },
    { name: "an unknown availability", query: "?availability=lost" },
    { name: "min_price above max_price", query: "?min_price=200&max_price=100" },
    { name: "a negative price", query: "?min_price=-1" },
    { name: "a fractional price", query: "?max_price=1.5" },
    { name: "page 0", query: "?page=0" },
    { name: "page_size 101", query: "?page_size=101" },
    { name: "page_size 0", query: "?page_size=0" },
    { name: "a 201 character q", query: `?q=${"a".repeat(201)}` },
    { name: "a text page", query: "?page=two" },
  ])("answers 422 for $name without searching", async ({ query }) => {
    const search = vi.fn();

    const { response, json } = await get(`/search${query}`, { search });

    expect(response.status).toBe(422);
    const validate = contractSchema("Problem");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(json.type).toBe("https://limitedwatches.dk/problems/validation_error");
    expect(search).not.toHaveBeenCalled();
  });

  it("answers 500 problem+json when MongoDB fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { response, json } = await get("/search", {
      search: async () => {
        throw new Error("mongo down");
      },
    });

    expect(response.status).toBe(500);
    expect(json.type).toBe("https://limitedwatches.dk/problems/internal_error");
  });
});

describe("GET /health", () => {
  it("answers 200 when the broker and MongoDB are up", async () => {
    const { response, json } = await get("/health");

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: "ok" });
  });

  it.each([
    { name: "broker down", broker: false, database: true, code: "broker_unavailable" },
    { name: "MongoDB down", broker: true, database: false, code: "database_unavailable" },
  ])("answers 503 when $name", async ({ broker, database, code }) => {
    const { response, json } = await get("/health", { isBrokerConnected: () => broker, isDatabaseReachable: async () => database });

    expect(response.status).toBe(503);
    expect(json.type).toBe(`https://limitedwatches.dk/problems/${code}`);
  });
});
