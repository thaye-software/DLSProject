import { z } from "zod";

export type OrderOwner = { orderId: string; userId: string };

const orderMetadataSchema = z.object({ order_id: z.uuid(), user_id: z.uuid() });

export function toOrderMetadata({ orderId, userId }: OrderOwner): Record<string, string> {
  return { order_id: orderId, user_id: userId };
}

export function orderOwnerFrom(metadata: unknown): OrderOwner | null {
  const parsed = orderMetadataSchema.safeParse(metadata);
  return parsed.success ? { orderId: parsed.data.order_id, userId: parsed.data.user_id } : null;
}
