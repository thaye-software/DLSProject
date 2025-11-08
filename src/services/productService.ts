import "server-only";

import { db } from "@/database/drizzle";
import { products, brands } from "@/database/schema.ts";
import { NewProductModel } from "@/database/types";

import { Products } from "../app/watches/type";
import { eq } from "drizzle-orm";

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
      const allProducts: Products[] = await db.query.products.findMany({
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

      return allProducts;

    } catch (error) {
      console.error("Error fetching products:", error);
      throw new Error("Failed to fetch products from database");
    }
  },

  //TODO optimise this funciton
  async getAllProductsByBrandName(brandSlug: string): Promise<Products[]> {
    try {
      const brand = await db.query.brands.findFirst({
        where: eq(brands.slug, brandSlug),
      });

      if (!brand) {
        return [];
      }

      const allProducts: Products[] = await this.getAllProducts();

      const filteredProducts = allProducts.filter(
        (product) => product.watch?.brand.id === brand.id
      );

      return filteredProducts;
      
    } catch (error) {
      console.error("Error fetching products by brand slug:", error);
      throw new Error("Failed to fetch products from database");
    }
  }

};
