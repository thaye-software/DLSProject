import type { ProductRepository } from "../../application/ports/product-repository.js";
import type { Product } from "../../domain/product.js";

export function createInMemoryProductRepository(products: readonly Product[]): ProductRepository {
  const byId = new Map(products.map((product) => [product.productId, product]));
  return {
    findById(productId) {
      return Promise.resolve(byId.get(productId) ?? null);
    },
  };
}
