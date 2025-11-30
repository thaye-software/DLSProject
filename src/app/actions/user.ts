"use server";

import { getUserById } from "@/services/userService";

export async function getUserByIdAction(userId: string) {
  return await getUserById(userId);
}
