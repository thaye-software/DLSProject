"use server";

import { revalidatePath } from "next/cache";

import { withLoginRedirect } from "@/lib/gateway";
import { problemMessage } from "@/lib/problemMessage";
import { cancelOrder } from "@/services/orderService";

// Returns an error message (the Orders problem title/detail) or null on success.
export async function cancelMyOrder(orderId: string): Promise<string | null> {
  try {
    await withLoginRedirect(() => cancelOrder(orderId));
  } catch (e) {
    return problemMessage(e, "The order could not be cancelled. Please try again later.", `Cancel order ${orderId} failed`);
  }
  revalidatePath("/orders");
  return null;
}
