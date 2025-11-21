"use server";

import { db } from "@/database/drizzle";
import { favorites } from "@/database/schema";
import { and, eq } from "drizzle-orm";
import { FavoriteModel, NewFavoriteModel } from "@/database/types";

export async function getUserFavorites(userId: string): Promise<Omit<FavoriteModel, "user">[]> {
  try {
  const results = await db.query.favorites.findMany({
    where: eq(favorites.userId, userId),
    with: {
      product: {
        with: {
          productImages: true,
          watch: {
            with: {
              brand: true
            }
          }
        }
      }
    }
  });
  return results;
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