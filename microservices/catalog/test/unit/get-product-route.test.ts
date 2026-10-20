import { describe, expect, it, vi } from "vitest";
import type { Product } from "../../src/domain/product.js";
import { serve } from "../support/serve.js";

const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const HIDDEN_ID = "1c0d9a3e-6b21-4f0a-9c55-7e2b8d4a1f30";

function submariner(overrides: Partial<Product> = {}): Product {
  return {
    productId: PRODUCT_ID,
    name: "Rolex Submariner Date 126610LN",
    slug: "rolex-submariner-date-126610ln",
    brandName: "Rolex",
    model: "Submariner Date",
    price: { amountMinor: 11_500_000, currency: "DKK" },
    availability: "available",
    thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
    stock: 1,
    version: 1,
    ...overrides,
  };
}

async function getProductResponse(productId: string, product: Product | null): Promise<Response> {
  const baseUrl = await serve({ getProduct: vi.fn(async () => product) });
  return fetch(`${baseUrl}/products/${productId}`);
}

describe("GET /products/{product_id}", () => {
  it("answers 200 with the product summary", async () => {
    const response = await getProductResponse(PRODUCT_ID, submariner());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product_id: PRODUCT_ID,
      name: "Rolex Submariner Date 126610LN",
      slug: "rolex-submariner-date-126610ln",
      brand_name: "Rolex",
      model: "Submariner Date",
      price: { amount_minor: 11_500_000, currency: "DKK" },
      availability: "available",
      thumbnail_url: "https://cdn.example.com/products/126610ln-1.jpg",
    });
  });

  it("answers 200 when the product is hidden", async () => {
    const response = await getProductResponse(
      HIDDEN_ID,
      submariner({
        productId: HIDDEN_ID,
        brandName: null,
        model: null,
        availability: "hidden",
        thumbnailUrl: null,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product_id: HIDDEN_ID,
      name: "Rolex Submariner Date 126610LN",
      slug: "rolex-submariner-date-126610ln",
      brand_name: null,
      model: null,
      price: { amount_minor: 11_500_000, currency: "DKK" },
      availability: "hidden",
      thumbnail_url: null,
    });
  });

  it("answers 404 when the id is missing", async () => {
    const getProduct = vi.fn(async () => null);
    const baseUrl = await serve({ getProduct });
    const response = await fetch(`${baseUrl}/products/${HIDDEN_ID}`);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toEqual({
      type: "https://limitedwatches.dk/problems/not_found",
      title: "Product not found",
      status: 404,
      detail: "Product not found.",
      instance: `/products/${HIDDEN_ID}`,
    });
    expect(getProduct).toHaveBeenCalledWith(HIDDEN_ID);
  });

  it("answers 404 when the id is not a UUID", async () => {
    const getProduct = vi.fn(async () => submariner());
    const baseUrl = await serve({ getProduct });
    const response = await fetch(`${baseUrl}/products/not-a-uuid`);

    expect(response.status).toBe(404);
    expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/not_found");
    expect(getProduct).not.toHaveBeenCalled();
  });
});
