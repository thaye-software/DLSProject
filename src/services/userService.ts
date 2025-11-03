import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";

export const userService = {
  async getAllUsers() {
    try {
      const allUsers = await db.select().from(users);
      return { success: true, data: allUsers };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { success: false, error: "Failed to fetch users" };
    }
  },

  async getUserById(id: number) {
    try {
      const user = await db.select().from(users).where(eq(users.id, id));
      return { success: true, data: user[0] || null };
    } catch (error) {
      console.error("Error fetching user:", error);
      return { success: false, error: "Failed to fetch user" };
    }
  },
} as const;
