

import { db } from "@/database/drizzle";
import { products, brands, watches } from "@/database/schema.ts";
import { NewProductModel } from "@/database/types";

import { Product } from "../app/watches/type";
import { eq, like, or } from "drizzle-orm";

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
      const allProducts: any[] = await db.query.products.findMany({
        with: {
          watch: {
            with: {
              brand: true,
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
  async getAllProductsByBrandName(brandName: string): Promise<Product[]> {
    try {
      const brand = await db.query.brands.findFirst({
        where: eq(brands.name, brandName),
      });

      if (!brand) {
        return [];
      }

      const allProducts: Product[] = await this.getAllProducts();

      const filteredProducts = allProducts.filter(
        (product) => product.watch?.brand.id === brand.id
      );

      return filteredProducts;
      
    } catch (error) {
      console.error("Error fetching products by brand slug:", error);
      throw new Error("Failed to fetch products from database");
    }
  },

  async getProductById(watchId: string | number): Promise<any | null> {
    try {
      const watch = await db.query.products.findFirst({
        where: eq(products.id, Number(watchId)),
        
        with: {
          watch: {
            with: {
              brand: true,
            },
          },
          productImages: true,
        },
      })

      if (watch === undefined || watch === null) {
        return null
      }

      return watch;

    } catch(error) {
      console.error(error);
      throw error;
    }
  },

  async searchProducts(query: string) {
    const lowerQuery = query.trim().toLowerCase();
    try {
      const results = await db.query.products.findMany({
        with: {
          watch: {
            with: {
              brand: true,
            },
          },
          productImages: true,
        }
      });

      // not optimal, but i cant figure out how to do it in the query
      // maybe try to optimitze later
      const filteredResults = results.filter((product) => {
        const nameMatch = product.name.toLowerCase().includes(lowerQuery);
        const brandMatch = product.watch?.brand.name
          .toLowerCase()
          .includes(lowerQuery);
        const referenceMatch = product.watch?.reference
          .toLowerCase()
          .includes(lowerQuery);

        return nameMatch || brandMatch || referenceMatch;
      });

      return filteredResults;
    } catch (error) {
      console.error("Error searching products:", error);
      throw new Error("Failed to search products in database");
    }
  } 

};
