import { db } from "@/database/drizzle";
import { watches, products, productImages } from "@/database/schema";
import { NewWatchModel, NewProductModel } from "@/database/types";
import { sql } from "drizzle-orm";

export const watchService = {
  async createWatch(data: Omit<NewWatchModel, "id">) {
    try {
      const result = await db.insert(watches).values(data).returning();
      return { success: true, data: result[0] };
    } catch (error) {
      console.error("Error creating watch:", error);
      return { success: false, error: "Failed to create watch" };
    }
  },

  /**
   * Create a watch + product + product images inside a single transaction.
   *
   * Note: schema currently has `products.watchId` (product -> watch) and
   * `products.imageId` (product -> product_images). `product_images` does not
   * reference `products` directly, so we insert images and set `products.imageId`
   * to the first inserted image's id. If you want many-to-one images -> product,
   * consider adding a `product_id` column on `product_images`.
   */
  async createWatchWithProductAndImages(opts: {
    watchData: Omit<NewWatchModel, "id">;
    productData: Omit<NewProductModel, "id" | "createdAt">;
    imageUrls?: string[]; // array of image URLs to insert
  }) {
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

          // Note: products table does not include an `imageId` column anymore.
          // Images are linked to the product via product_images.product_id.
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
