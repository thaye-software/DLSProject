import { db } from "@/database/drizzle";
import { products, watches } from "@/database/migrations/schema";
import { NewProductModel } from "@/database/types";

export const productService = {
  async createProduct(data: Omit<NewProductModel, "id" | "createdAt">) {
    try {
      const result = await db.insert(products).values(data).returning();
      return { success: true, data: result[0] };
    } catch (error) {
      console.error("Error creating product:", error);
      return { success: false, error: "Failed to create product" };
    }
  },

  async getAllProducts() {
    try {
      const allProducts = await db.query.products.findMany({
        with: {
          watch: {
            with: {
              brand: {
                with: {
                  productSafetyInfo: true,
                },
              },
            },
          },
          productImages: true,
        },
      });
      return { success: true, data: allProducts };
    } catch (error) {
      console.error("Error fetching products:", error);
      return { success: false, error: "Failed to fetch products" };
    }
  },
};
