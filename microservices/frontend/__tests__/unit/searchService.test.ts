/** @jest-environment node */
import { GatewayError, gatewayFetch } from "@/lib/gateway";
import { filtersFromParams, searchErrorMessage, toSearchQuery, watchHref } from "@/services/searchService";
import { getProduct } from "@/services/productService";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/gateway", () => {
  class GatewayError extends Error {
    constructor(public status: number, public problem: unknown = null) {
      super(`Gateway error ${status}`);
    }
  }
  return { GatewayError, gatewayFetch: jest.fn() };
});

describe("toSearchQuery", () => {
  it("converts DKK to minor units and renames page_size", () => {
    expect(toSearchQuery({ q: "sub", minPriceDkk: 1000, maxPriceDkk: 5000, pageSize: 24 })).toEqual({
      q: "sub",
      min_price: 100000,
      max_price: 500000,
      page_size: 24,
    });
  });
  it("leaves unset filters undefined", () => {
    const q = toSearchQuery({});
    expect(Object.values(q).every((v) => v === undefined)).toBe(true);
  });
});

describe("filtersFromParams", () => {
  it("parses URL params and ignores junk numbers", () => {
    expect(filtersFromParams({ q: "x", brand: "rolex", minPrice: "10", maxPrice: "abc", page: ["2"] })).toEqual({
      q: "x",
      brand: "rolex",
      availability: undefined,
      minPriceDkk: 10,
      maxPriceDkk: undefined,
      page: 2,
    });
  });
});

describe("watchHref", () => {
  it("builds the canonical watch URL", () => {
    expect(watchHref({ product_id: "p1", slug: "rolex-sub" })).toBe("/watches/view/p1/rolex-sub");
  });
});

describe("getProduct", () => {
  const fetchMock = gatewayFetch as jest.Mock;
  it("returns null on 404", async () => {
    fetchMock.mockRejectedValue(new GatewayError(404, null));
    await expect(getProduct("p1")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/products/p1", { auth: false });
  });
  it("returns null on 400 (malformed id)", async () => {
    fetchMock.mockRejectedValue(new GatewayError(400, null));
    await expect(getProduct("bad")).resolves.toBeNull();
  });
  it("rethrows 500", async () => {
    fetchMock.mockRejectedValue(new GatewayError(500, null));
    await expect(getProduct("p1")).rejects.toMatchObject({ status: 500 });
  });
});

describe("searchErrorMessage", () => {
  it("shows problem title and detail from a GatewayError", () => {
    const e = new GatewayError(503, { type: "x", title: "Service unavailable", status: 503, detail: "search is down" });
    expect(searchErrorMessage(e)).toBe("Service unavailable: search is down");
  });
  it("falls back to a generic message and logs other errors", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const msg = searchErrorMessage(new GatewayError(502, null));
    expect(msg).toMatch(/could not be loaded/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
