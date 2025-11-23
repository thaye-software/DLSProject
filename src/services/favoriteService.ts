"use server";

import { db } from "@/database/drizzle";
import { favorites, products, watches, brands, productImages } from "@/database/schema";
import { and, eq, gte } from "drizzle-orm";
import { FavoriteModel, NewFavoriteModel, ProductModel } from "@/database/types";
import { Product } from "@/app/watches/type";

export async function getUserFavorites(userId: string): Promise<ProductModel[]> {
  try {
  const results = await db.query.favorites.findMany({
    where: eq(favorites.userId, userId),
    with: {
      product: {
        with: {
          productImages: true,
          watch: {
            with: {
              brand: true,
            },
          },
        },
      },
    },
  });
    
    // get only product from results
    const products = results.map((r) => r.product);
    // filter out products stock is less than 1    
    return products.filter((product) => {
      return product ? product.stock >= 1 : true;
    });
  } catch (error) {
    console.error("Error fetching user favorites:", error);
    throw error;
  }
}

export async function isFavorite(userId: string, productId: string): Promise<boolean> {
  const favorite =  await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.productId, productId)
    )
  });
  return !!favorite;
}

export async function handleFavoriteToggle(userId: string, productId: string): Promise<void> {
  const isFavorite = await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.productId, productId)
    )
  });
  if (isFavorite) {
    return await removeFavorite(userId, productId);
  } else {
    return await addFavorite(userId, productId);
  }
}

// Helper functions for handleFavoriteToggle
async function addFavorite(userId: string, productId: string): Promise<void> {

  await db.insert(favorites).values({ userId, productId });
}

async function removeFavorite(userId: string, productId: string): Promise<void> {

  await db.delete(favorites)
    .where(
      and(
        (eq(favorites.userId, userId), eq(favorites.productId, productId))
      )
    );
}

export async function getFavoritedProductsByUserId(userId: string): Promise<ProductModel[]> {
  try {
    // JOIN favorites -> products -> watches -> brands and include thumbnail image
    const rows = await db
      .select({ product: products, watch: watches, brand: brands, image: productImages.imageUrl })
      .from(favorites)
      .innerJoin(products, eq(products.id, favorites.productId))
      .innerJoin(watches, eq(watches.productId, products.id))
      .innerJoin(brands, eq(brands.id, watches.brandId))
      .leftJoin(
        productImages,
        and(eq(productImages.productId, products.id), eq(productImages.isThumbnail, true))
      )
      .where(and(eq(favorites.userId, userId), gte(products.stock, 1)));

    // Map rows into ProductModel shape
    const productsResult: ProductModel[] = rows.map((row) => ({
      ...row.product,
      productImages: row.image
        ? [
            {
              id: "thumbnail",
              productId: row.product.id,
              imageUrl: row.image,
              isThumbnail: true,
            },
          ]
        : [],
      watch: {
        ...row.watch,
        brand: {
          ...row.brand,
        },
      },
    }));

    return productsResult;
  } catch (error) {
    console.error("Error fetching favorited products:", error);
    throw new Error("Failed to fetch favorited products from database");
  }
}