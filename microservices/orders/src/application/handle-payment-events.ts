import { buildOrderEvent, orderConfirmedData } from "../domain/order-event.js";
import type { Order, OrderStatus } from "../domain/order.js";
import type { ApplyResult, Decision, OrderEventStore } from "./ports/order-event-store.js";

// The data Orders reads from payment.events (docs/contracts/asyncapi.yaml).
export type Money = { amount_minor: number; currency: string };
export type PaymentComplete = { payment_intent_id: string; order_id: string; user_id: string; amount: Money; paid_at: string };
export type PaymentFailed = {
  payment_intent_id: string;
  order_id: string;
  failure_code: string | null;
  failure_message: string | null;
};
export type PaymentRefunded = { payment_intent_id: string; order_id: string; refund_request_id: string | null; amount: Money };

export type PaymentEventDependencies = {
  store: OrderEventStore;
  now: () => Date;
  newId: () => string;
};

// Statuses in which the order holds stock in Catalog.
const ACTIVE_STATUSES: readonly OrderStatus[] = ["RESERVED", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

export function decidePaymentComplete(order: Order, payment: PaymentComplete, causationId: string, now: Date, newId: () => string): Decision {
  switch (order.status) {
    case "RESERVED":
      // Paid even if expires_at just passed: the sweeper hasn't released the stock yet, so the order can still be fulfilled.
      return {
        status: "PENDING",
        publish: [
          buildOrderEvent({
            id: newId(),
            type: "order_confirmed",
            orderId: order.id,
            time: now,
            causationId,
            data: orderConfirmedData(order, now),
          }),
        ],
        note: "confirmed (RESERVED → PENDING)",
      };
    case "EXPIRED":
    case "CANCELLED": {
      const reason = order.status === "EXPIRED" ? "paid_after_expiry" : "cancelled_after_payment";
      return {
        status: null,
        publish: [
          buildOrderEvent({
            id: newId(),
            type: "refund_requested",
            orderId: order.id,
            time: now,
            causationId,
            data: {
              refund_request_id: newId(),
              order_id: order.id,
              user_id: order.userId,
              // Refund what was actually charged.
              amount: { amount_minor: payment.amount.amount_minor, currency: "DKK" },
              reason,
              requested_at: now.toISOString(),
            },
          }),
        ],
        note: `paid while ${order.status}, refund requested (${reason})`,
      };
    }
    default:
      // Already paid (a redelivery from Stripe under a new event id): nothing to do.
      return { status: null, publish: [], note: `already ${order.status}, ignored` };
  }
}

export function decidePaymentFailed(order: Order, failure: PaymentFailed): Decision {
  // The order stays RESERVED so the customer can retry until it expires.
  const reason = failure.failure_code ?? failure.failure_message ?? "no reason given";
  return { status: null, publish: [], note: `payment attempt failed (${reason}), order stays ${order.status}` };
}

export function decidePaymentRefunded(order: Order): Decision {
  if (order.status === "REFUNDED") return { status: null, publish: [], note: "already REFUNDED" };

  if (ACTIVE_STATUSES.includes(order.status)) {
    // shortcut: a refund made directly in Stripe for an active order sets REFUNDED but doesn't tell Catalog to
    // put the stock back, because order_status_changed needs a changed_by user (DECISIONS.md). Fix once that's decided.
    return {
      status: "REFUNDED",
      publish: [],
      note: `refunded while ${order.status}; Catalog was NOT told to put the stock back`,
    };
  }
  // EXPIRED, CANCELLED or RETURNED: the stock was already released when the order got there.
  return { status: "REFUNDED", publish: [], note: `${order.status} → REFUNDED` };
}

export function onPaymentComplete(payment: PaymentComplete, eventId: string, { store, now, newId }: PaymentEventDependencies): Promise<ApplyResult> {
  return store.apply({
    eventId,
    eventType: "payment_complete",
    orderId: payment.order_id,
    decide: (order) => decidePaymentComplete(order, payment, eventId, now(), newId),
  });
}

export function onPaymentFailed(failure: PaymentFailed, eventId: string, { store }: PaymentEventDependencies): Promise<ApplyResult> {
  return store.apply({ eventId, eventType: "payment_failed", orderId: failure.order_id, decide: (order) => decidePaymentFailed(order, failure) });
}

export function onPaymentRefunded(refund: PaymentRefunded, eventId: string, { store }: PaymentEventDependencies): Promise<ApplyResult> {
  return store.apply({ eventId, eventType: "payment_refunded", orderId: refund.order_id, decide: decidePaymentRefunded });
}
