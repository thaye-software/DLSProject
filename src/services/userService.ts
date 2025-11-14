"use server";

import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { UserModel, NewUserModel } from "@/database/types";


  export async function getAllUsers() {
    try {
      const allUsers = await db.select().from(users);
      return { success: true, data: allUsers };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { success: false, error: "Failed to fetch users" };
    }
  }

  export async function getUserById(id: string) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      })
      return user;
    } catch (error) {
      console.error("Error fetching user:", error);
      return { error: "Failed to fetch user" };
    }
  }

  export async function getUserByUsername(username: string) {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      return { success: true, data: user[0] || null };
    } catch (error) {
      console.error("Error fetching user by username:", error);
      return { success: false, error: "Failed to fetch user by username" };
    }
  }

  export async function getUserByEmail(email: string) {
    try {
      const user = await db.select().from(users).where(eq(users.email, email));
      return { success: true, data: user[0] || null };
    } catch (error) {
      console.error("Error fetching user by email:", error);
      return { success: false, error: "Failed to fetch user by email" };
    }
  }

  export async function createUser(user: NewUserModel) {
    // check if user with the same username already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, user.username));

    if (existingUser.length > 0) {
      return {
        success: false,
        error: "User with the same username already exists",
      };
    }
    // check if user with the same email already exists
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email));

    if (existingEmail.length > 0) {
      return {
        success: false,
        error: "User with the same email already exists",
      };
    }

    try {
      const newUser = await db.insert(users).values(user).returning();
      return { success: true, data: newUser };
    } catch (error) {
      console.error("Error creating user:", error);
      return {
        success: false,
        error: "Something went wrong. please try again.",
      };
    }
  }

