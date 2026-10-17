import type { OrderEvent } from "../../domain/order-event.js";
import type { Order, OrderStatus } from "../../domain/order.js";

export type Decision = {
  // The order's new status, or null to leave it.
  status: OrderStatus | null;
  // Events to publish through the outbox.
  publish: OrderEvent[];
  // What happened, for the log.
  note: string;
};

export type ApplyInput = {
  eventId: string;
  eventType: string;
  orderId: string;
  decide: (order: Order) => Decision;
};

export type ApplyResult = { kind: "applied"; note: string } | { kind: "duplicate" };

export type OrderEventStore = {
  // In one transaction: skip an event id seen before (inbox), load the order, store the decision only if
  // the order hasn't changed meanwhile, and write the events to publish (outbox).
  // Throws if the order doesn't exist or changed concurrently, so the consumer retries.
  apply(input: ApplyInput): Promise<ApplyResult>;
};
