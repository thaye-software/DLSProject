import { buildOrderEvent, type OrderEvent } from "../domain/order-event.js";
import type { Order } from "../domain/order.js";
import type { ExpiryStore } from "./ports/expiry-store.js";

export type ExpireOrdersDependencies = {
  store: ExpiryStore;
  now: () => Date;
  newId: () => string;
  batchSize?: number;
};

const DEFAULT_BATCH_SIZE = 100;

export function orderExpiredEvent(order: Order, now: Date, newId: () => string): OrderEvent<"order_expired"> {
  return buildOrderEvent({
    id: newId(),
    type: "order_expired",
    orderId: order.id,
    time: now,
    causationId: null,
    data: {
      order_id: order.id,
      user_id: order.userId,
      items: order.items.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
      reserved_at: order.createdAt.toISOString(),
      // When the reservation ran out, not when the sweeper noticed.
      expired_at: (order.expiresAt ?? now).toISOString(),
    },
  });
}

// Expires every RESERVED order past its expires_at, a batch at a time; returns how many it expired.
export async function expireDueOrders({ store, now, newId, batchSize = DEFAULT_BATCH_SIZE }: ExpireOrdersDependencies): Promise<number> {
  let total = 0;
  for (;;) {
    const time = now();
    const expired = await store.expireDue({ now: time, limit: batchSize, buildEvent: (order) => orderExpiredEvent(order, time, newId) });
    total += expired.length;
    if (expired.length < batchSize) return total;
  }
}
