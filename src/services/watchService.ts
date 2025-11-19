import { db } from "@/database/drizzle";
import { watches, brands, products, productImages } from "@/database/schema";
import { NewWatchModel, NewProductModel } from "@/database/types";
import { asc, desc, eq, sql } from "drizzle-orm";

export const watchService = {

  /**
   * Create a watch + product + product images inside a single transaction.
   * @param opts 
   * @returns 
   */
  async createWatchWithProductAndImages(opts: {
    watchData: Omit<NewWatchModel, "id" | "productId" | "slug">;
    productData: Omit<NewProductModel, "id" | "createdAt">;
    imageUrls?: string[]; // array of image URLs to insert
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const { watchData, productData, imageUrls } = opts;

    try {
      const result = await db.transaction(async (tx) => {

        // 1) create product first (without imageId) linking to watch
        const productToInsert: Omit<NewProductModel, "id" | "createdAt"> = {
          ...productData,
        };

        const prodRes = await tx
          .insert(products)
          .values(productToInsert)
          .returning();
        let createdProduct = prodRes[0];

        const brand = await tx
          .select()
          .from(brands)
          .where(eq(brands.id, watchData.brandId))
          .limit(1)
          .then((res) => res[0]);

        // 2) create watch
        const watchToInsert = {
          ...watchData,
          productId: createdProduct.id,
          slug: `${brand.name.toLowerCase().replace(/\s+/g, "-")}-${watchData.model.toLowerCase().replace(/\s+/g, "-")}-${createdProduct.id}`,
        };

        const watchInsert = await tx
          .insert(watches)
          .values(watchToInsert)
          .returning();
        const createdWatch = watchInsert[0];

        

        // 3) create product images (if any), linking them to the created product via product_id
        const createdImages: Array<{
          id: string;
          imageUrl: string;
          productId: string | null;
        }> = [];
        if (imageUrls && imageUrls.length) {
          for (const url of imageUrls) {
            const imgRes = await tx
              .insert(productImages)
              .values({ imageUrl: url, productId: createdProduct.id })
              .returning();
            createdImages.push(imgRes[0]);
          }
        }

        return {
          watch: createdWatch,
          product: createdProduct,
          images: createdImages,
        };
      });

      return { success: true, data: result };
    } catch (error) {
      console.error("Error creating watch+product+images:", error);
      return {
        success: false,
        error: "Failed to create watch, product and images",
      };
    }
  },

  async getFilterSizeRange() {
    try { 
      const [largest] = await db
        .select()
        .from(watches)
        .orderBy(desc(watches.size))
        .limit(1);

      const [smallest] = await db
        .select()
        .from(watches)
        .orderBy(asc(watches.size))
        .limit(1);

      return {
        smallest: smallest?.size ?? 23,
        largest: largest?.size ?? 52
      }
      
    } catch (error) {
      console.error("(server) failed to get watch size filter range", error);
      throw error;
    }
  },

  async getFilterYearRange() {
    try { 
      const [newest] = await db
        .select()
        .from(watches)
        .orderBy(desc(watches.year))
        .limit(1);

      const [oldest] = await db
        .select()
        .from(watches)
        .orderBy(asc(watches.year))
        .limit(1);

      return {
        oldest: oldest.year ?? null,
        newest: newest.year ?? null
      }
    } catch (error) {
      console.error("(server) failed to get watch year filter range", error);
      throw error;
    }
  },

  async getUniqueConditions() {
    try {
      const results = await db
        .select({
          condition: watches.condition,
          count: sql<number>`COUNT(*)`
        })
        .from(watches)
        .groupBy(watches.condition)
        .orderBy(watches.condition);

      return results;

    } catch (error) {
      console.error("(server) failed to get watch condition stats", error);
      throw error;
    }
  }
} as const;
