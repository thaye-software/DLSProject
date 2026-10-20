import type { Product } from "../../domain/product.js";

export function productSummaryJson(product: Product) {
  return {
    product_id: product.productId,
    name: product.name,
    slug: product.slug,
    brand_name: product.brandName,
    model: product.model,
    price: { amount_minor: product.price.amountMinor, currency: product.price.currency },
    availability: product.availability,
    thumbnail_url: product.thumbnailUrl,
  };
}
