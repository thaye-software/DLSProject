"use server";

import { getUserLocation } from "@/lib/utils/server/utils";

export async function getUserLocationAction() {
  return await getUserLocation();
}
