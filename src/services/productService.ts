import { db } from "@/database/drizzle";
import { products } from "@/database/migrations/schema";

export interface Product {
  id: number;
  productId: string;
  productType: string;
  name: string;
  priceDkk: number;
  description: string;
  imageId: number;
}

export const productService = {
  async createProduct(data: Omit<Product, "id">) {
    try {
      const result = await db.insert(products).values(data).returning();
      return { success: true, data: result[0] };
    } catch (error) {
      console.error("Error creating product:", error);
      return { success: false, error: "Failed to create product" };
    }
  },
} as const;