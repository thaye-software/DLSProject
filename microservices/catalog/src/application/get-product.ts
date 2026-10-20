import type { Product } from "../domain/product.js";
import type { ProductRepository } from "./ports/product-repository.js";

// A hidden product is still returned. Callers decide what to do with availability.
export function getProduct(productId: string, products: Pick<ProductRepository, "findById">): Promise<Product | null> {
  return products.findById(productId);
}
