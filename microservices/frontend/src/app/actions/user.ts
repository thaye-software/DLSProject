"use server";

import { getCustomerInfoByEmail, getUserById } from "@/services/userService";

export async function getUserByIdAction(userId: string) {
  return await getUserById(userId);
}

export async function getUserByEmailAction(email: string) {
  return await getCustomerInfoByEmail(email);
}