import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpCatalogClient } from "../../src/adapters/catalog/http-catalog-client.js";
import { PRODUCT_ID, product } from "../fixtures/chat.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function catalogJson() {
  return {
    product_id: product.productId,
    name: product.name,
    slug: "rolex-submariner-date-126610ln",
    brand_name: "Rolex",
    model: "Submariner Date",
    price: { amount_minor: 11500000, currency: "DKK" },
    availability: "available",
    thumbnail_url: product.thumbnailUrl,
  };
}

describe("HttpCatalogClient", () => {
  it("maps a ProductSummary to the fields Messaging snapshots", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(catalogJson()), { status: 200 })));

    await expect(new HttpCatalogClient("http://catalog:3002").getProduct(PRODUCT_ID)).resolves.toEqual({
      kind: "found",
      product,
    });
    expect(fetch).toHaveBeenCalledWith(new URL(`http://catalog:3002/products/${PRODUCT_ID}`), expect.anything());
  });

  it("maps 404 to not_found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    await expect(new HttpCatalogClient("http://catalog:3002").getProduct(PRODUCT_ID)).resolves.toEqual({ kind: "not_found" });
  });

  it.each([500, 502])("maps HTTP %s to unavailable", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));

    await expect(new HttpCatalogClient("http://catalog:3002").getProduct(PRODUCT_ID)).resolves.toEqual({ kind: "unavailable" });
  });

  it("maps a network failure to unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    await expect(new HttpCatalogClient("http://catalog:3002").getProduct(PRODUCT_ID)).resolves.toEqual({ kind: "unavailable" });
  });
});
