import type { OrderEvent } from "../../domain/order-event.js";
import type { Order } from "../../domain/order.js";

export type ExpireDueInput = {
  now: Date;
  limit: number;
  // The event announcing one order's expiry, written to the outbox with the status change.
  buildEvent: (order: Order) => OrderEvent;
};

export type ExpiryStore = {
  // In one transaction: claim up to `limit` RESERVED orders whose expires_at has passed, set them EXPIRED and
  // write their events to the outbox. Returns the ids it expired.
  expireDue(input: ExpireDueInput): Promise<string[]>;
};
