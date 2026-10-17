import type { OrderEvent } from "../../domain/order-event.js";
import type { Order, OrderStatus } from "../../domain/order.js";

export type CommandDecision<R extends string> =
  | { kind: "reject"; reason: R }
  // Nothing to do, e.g. cancelling an order that is already CANCELLED.
  | { kind: "keep" }
  | { kind: "change"; status: OrderStatus; publish: OrderEvent[] };

export type CommandResult<R extends string> =
  | { kind: "not_found" }
  | { kind: "rejected"; reason: R }
  | { kind: "done"; order: Order };

export type OrderCommandStore = {
  // In one transaction: lock the order row, decide on the current state, and store the new status together with
  // its events in the outbox. The lock makes the expiry sweeper and payment handlers wait, so nothing changes
  // between the decision and the write.
  change<R extends string>(orderId: string, decide: (order: Order) => CommandDecision<R>): Promise<CommandResult<R>>;
};
