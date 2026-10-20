import type { Product } from "../../domain/product.js";

export type ProductRepository = {
  findById(productId: string): Promise<Product | null>;
};
