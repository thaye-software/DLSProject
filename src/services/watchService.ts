import { db } from "@/database/drizzle";
import { watches, products, productImages } from "@/database/schema";
import { NewWatchModel, NewProductModel } from "@/database/types";

export const watchService = {

  /**
   * Create a watch + product + product images inside a single transaction.
   * @param opts 
   * @returns 
   */
  async createWatchWithProductAndImages(opts: {
    watchData: Omit<NewWatchModel, "id">;
    productData: Omit<NewProductModel, "id" | "createdAt">;
    imageUrls?: string[]; // array of image URLs to insert
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const { watchData, productData, imageUrls } = opts;

    try {
      const result = await db.transaction(async (tx) => {
        // 1) create watch
        const watchInsert = await tx
          .insert(watches)
          .values(watchData)
          .returning();
        const createdWatch = watchInsert[0];

        // 2) create product first (without imageId) linking to watch
        const productToInsert: Omit<NewProductModel, "id" | "createdAt"> = {
          ...productData,
          watchId: createdWatch.id,
        };

        const prodRes = await tx
          .insert(products)
          .values(productToInsert)
          .returning();
        let createdProduct = prodRes[0];

        // 3) create product images (if any), linking them to the created product via product_id
        const createdImages: Array<{
          id: number;
          imageUrl: string;
          productId: number | null;
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
} as const;
