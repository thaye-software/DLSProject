"use server";

import { db } from "@/database/drizzle";
import { favorites } from "@/database/schema";
import { and, eq } from "drizzle-orm";

export async function getUserFavorites(userId: string) {
  return await db.query.favorites.findMany({
    where: eq(favorites.userId, userId)
  });
}

export async function isFavorite(userId: string, watchId: string) {
  const favorite =  await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.watchId, watchId)
    )
  });
  return !!favorite;
}

export async function handleFavoriteToggle(userId: string, watchId: string) {
  const isFavorite = await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.watchId, watchId)
    )
  });
  if (isFavorite) {
    return await removeFavorite(userId, watchId);
  } else {
    return await addFavorite(userId, watchId);
  }
}

// Helper functions for handleFavoriteToggle
async function addFavorite(userId: string, watchId: string) {

  console.log("Adding favorite:", { userId, watchId });
  return await db.insert(favorites).values({ userId, watchId });
}

async function removeFavorite(userId: string, watchId: string) {

  return await db.delete(favorites)
    .where(
      and(
        (eq(favorites.userId, userId), eq(favorites.watchId, watchId))
      )
    );
}