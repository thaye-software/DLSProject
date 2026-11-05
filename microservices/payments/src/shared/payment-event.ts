import type { Money } from "./money.js";
import { uuidV5 } from "./uuid-v5.js";

// Never change: Orders deduplicates on the event id, and Stripe redelivers webhooks for days.
const STRIPE_EVENT_NAMESPACE = "fd41eb03-082a-4904-ab42-27ba20a9148b";

export type PaymentEventData = {
  payment_complete: {
    payment_intent_id: string;
    order_id: string;
    user_id: string;
    amount: Money;
    paid_at: string;
  };
  payment_failed: {
    payment_intent_id: string;
    order_id: string;
    user_id: string;
    amount: Money;
    failure_code: string | null;
    failure_message: string | null;
    failed_at: string;
  };
  payment_refunded: {
    payment_intent_id: string;
    order_id: string;
    user_id: string;
    refund_request_id: string | null;
    amount: Money;
    stripe_refund_id: string;
    refunded_at: string;
  };
};

export type PaymentEventType = keyof PaymentEventData;

export type PaymentEvent<T extends PaymentEventType = PaymentEventType> = {
  specversion: "1.0";
  id: string;
  source: "/services/payment";
  type: T;
  time: string;
  datacontenttype: "application/json";
  subject: string;
  dataversion: 1;
  correlationid: string;
  causationid: null;
  data: PaymentEventData[T];
};

export type NewPaymentEvent<T extends PaymentEventType> = {
  stripeEventId: string;
  type: T;
  orderId: string;
  time: Date;
  data: PaymentEventData[T];
};

export function buildPaymentEvent<T extends PaymentEventType>({
  stripeEventId,
  type,
  orderId,
  time,
  data,
}: NewPaymentEvent<T>): PaymentEvent<T> {
  return {
    specversion: "1.0",
    id: uuidV5(stripeEventId, STRIPE_EVENT_NAMESPACE),
    source: "/services/payment",
    type,
    time: time.toISOString(),
    datacontenttype: "application/json",
    subject: orderId,
    dataversion: 1,
    correlationid: orderId,
    causationid: null,
    data,
  };
}
