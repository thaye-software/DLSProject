import { describe, expect, it } from "vitest";
import { createInMemoryProductRepository } from "../../src/adapters/memory/in-memory-product-repository.js";
import { getProduct } from "../../src/application/get-product.js";
import type { Product } from "../../src/domain/product.js";

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

describe("getProduct", () => {
  it("returns a stored product", async () => {
    const products = createInMemoryProductRepository([submariner()]);

    await expect(getProduct(PRODUCT_ID, products)).resolves.toEqual(submariner());
  });

  it("returns a hidden product", async () => {
    const hidden = submariner({
      productId: HIDDEN_ID,
      brandName: null,
      model: null,
      availability: "hidden",
      thumbnailUrl: null,
    });
    const products = createInMemoryProductRepository([hidden]);

    await expect(getProduct(HIDDEN_ID, products)).resolves.toEqual(hidden);
  });

  it("returns null when the id is missing", async () => {
    const products = createInMemoryProductRepository([submariner()]);

    await expect(getProduct(HIDDEN_ID, products)).resolves.toBeNull();
  });
});
