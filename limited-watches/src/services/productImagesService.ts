import { db } from "@/database/drizzle";
import { productImages } from "@/database/schema";
import { ProductImageModel, NewProductImageModel } from "@/database/types";

export const productImagesService = {
  async createProductImage(
    data: Omit<NewProductImageModel, "id">
  ) {
    try {
      const result = await db.insert(productImages).values(data).returning();
      return { success: true, data: result[0] as ProductImageModel };
    } catch (error) {
      console.error("Error creating product image:", error);
      return { success: false, error: "Failed to create product image" };
    }
  },
} as const;