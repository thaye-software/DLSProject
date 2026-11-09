"use server";

import { withLoginRedirect } from "@/lib/gateway";
import { problemMessage } from "@/lib/problemMessage";
import { updateOrderStatus as update, type UpdateOrderStatusRequest } from "@/services/orderService";

// Returns an error message (the Orders problem title/detail) or null on success.
export async function updateOrderStatus(orderId: string, status: UpdateOrderStatusRequest["status"]): Promise<string | null> {
  try {
    await withLoginRedirect(() => update(orderId, { status }));
    return null;
  } catch (e) {
    return problemMessage(e, "Failed to update order status.", `Update order ${orderId} failed`);
  }
}
