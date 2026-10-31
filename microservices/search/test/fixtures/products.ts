import type { Listing } from "../../src/domain/listing.js";
import type { ProductSnapshot } from "../../src/domain/snapshot.js";

export const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
export const OTHER_PRODUCT_ID = "0c5e1f2a-3b4d-4e6f-8a9b-1c2d3e4f5a6b";
export const BRAND_ID = "5e0c7a1b-3f2d-4c6e-9b8a-1d2e3f4a5b6c";
export const OTHER_BRAND_ID = "3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";

export const snapshot: ProductSnapshot = {
  product_id: PRODUCT_ID,
  version: 3,
  name: "Rolex Submariner Date 126610LN",
  price: { amount_minor: 11_500_000, currency: "DKK" },
  availability: "available",
  watch: {
    slug: "rolex-submariner-date-126610ln",
    brand: { brand_id: BRAND_ID, name: "Rolex", slug: "rolex" },
    model: "Submariner Date",
    reference: "126610LN",
    year: 2023,
    condition: 1,
    size_mm: 41,
    limited: false,
  },
  images: [
    { url: "https://cdn.example.com/products/126610ln-2.jpg", is_thumbnail: false },
    { url: "https://cdn.example.com/products/126610ln-1.jpg", is_thumbnail: true },
  ],
  updated_at: "2026-10-14T10:00:00Z",
};

export function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    productId: PRODUCT_ID,
    version: 3,
    name: "Rolex Submariner Date 126610LN",
    slug: "rolex-submariner-date-126610ln",
    brandId: BRAND_ID,
    brandName: "Rolex",
    brandSlug: "rolex",
    model: "Submariner Date",
    reference: "126610LN",
    year: 2023,
    sizeMm: 41,
    condition: 1,
    limited: false,
    priceDkk: 11_500_000,
    availability: "available",
    thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
    updatedAt: new Date("2026-10-14T10:00:00Z"),
    ...overrides,
  };
}
