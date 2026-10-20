import type { Product } from "../../domain/product.js";
import { productData, type ProductRow } from "./prisma-product-repository.js";
import type { Database } from "./prisma.js";

// The product id Orders' local fixtures already reserve, so one local order has something to hold.
export const SEEDED_PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";

export const seededProduct: Product = {
  productId: SEEDED_PRODUCT_ID,
  name: "Rolex Submariner Date 126610LN",
  slug: "rolex-submariner-date-126610ln",
  brandName: "Rolex",
  model: "Submariner Date",
  price: { amountMinor: 11_500_000, currency: "DKK" },
  availability: "available",
  thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
  stock: 1,
  version: 1,
};

// Inserts the sample watch. A second run leaves the stored row alone, including stock already reserved.
export async function seedCatalog(database: Database): Promise<void> {
  const data: ProductRow = productData(seededProduct);
  await database.product.upsert({
    where: { id: seededProduct.productId },
    create: data,
    update: {},
  });
}
