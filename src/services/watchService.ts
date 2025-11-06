import { db } from "@/database/drizzle";
import { watches } from "@/database/schema";
import { NewWatchModel } from "@/database/types";

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
} as const;