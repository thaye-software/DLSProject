import { z } from "zod";
import {
  onPaymentComplete,
  onPaymentFailed,
  onPaymentRefunded,
  type PaymentEventDependencies,
} from "../../application/handle-payment-events.js";
import type { ApplyResult } from "../../application/ports/order-event-store.js";
import { handleEvent, type EventHandler } from "./consumer.js";

export const PAYMENT_EVENTS_EXCHANGE = "payment.events";
export const PAYMENT_EVENTS_QUEUE = "orders.payment.events";

// Only the fields Orders uses; consumers ignore unknown fields (docs/contracts/README.md §1).
const moneySchema = z.object({ amount_minor: z.number().int().min(0), currency: z.string().regex(/^[A-Z]{3}$/) });

export const paymentCompleteSchema = z.object({
  payment_intent_id: z.string().startsWith("pi_"),
  order_id: z.uuid(),
  user_id: z.uuid(),
  amount: moneySchema,
  paid_at: z.iso.datetime({ offset: true }),
});

export const paymentFailedSchema = z.object({
  payment_intent_id: z.string().startsWith("pi_"),
  order_id: z.uuid(),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
});

export const paymentRefundedSchema = z.object({
  payment_intent_id: z.string().startsWith("pi_"),
  order_id: z.uuid(),
  refund_request_id: z.uuid().nullable(),
  amount: moneySchema,
});

function logged(type: string, eventId: string, orderId: string, result: ApplyResult): void {
  const outcome = result.kind === "duplicate" ? "already handled, skipped" : result.note;
  console.log(`${type} ${eventId}: order ${orderId} ${outcome}`);
}

export function createPaymentEventHandlers(dependencies: PaymentEventDependencies): Record<string, EventHandler> {
  return {
    payment_complete: handleEvent(paymentCompleteSchema, async (data, event) => {
      logged(event.type, event.id, data.order_id, await onPaymentComplete(data, event.id, dependencies));
    }),
    payment_failed: handleEvent(paymentFailedSchema, async (data, event) => {
      logged(event.type, event.id, data.order_id, await onPaymentFailed(data, event.id, dependencies));
    }),
    payment_refunded: handleEvent(paymentRefundedSchema, async (data, event) => {
      logged(event.type, event.id, data.order_id, await onPaymentRefunded(data, event.id, dependencies));
    }),
  };
}
