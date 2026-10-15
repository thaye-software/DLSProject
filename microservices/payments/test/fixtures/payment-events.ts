import type { PaymentEventData } from "../../src/domain/payment-event.js";

export const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
export const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";

export const paymentCompleteData: PaymentEventData["payment_complete"] = {
  payment_intent_id: "pi_3Q0abcDEF123",
  order_id: ORDER_ID,
  user_id: USER_ID,
  amount: { amount_minor: 11530000, currency: "DKK" },
  paid_at: "2026-10-14T10:04:08.000Z",
};

export const paymentFailedData: PaymentEventData["payment_failed"] = {
  payment_intent_id: "pi_3Q0abcDEF123",
  order_id: ORDER_ID,
  user_id: USER_ID,
  amount: { amount_minor: 11530000, currency: "DKK" },
  failure_code: "card_declined",
  failure_message: "Your card was declined.",
  failed_at: "2026-10-14T10:03:00.000Z",
};

export const paymentRefundedData: PaymentEventData["payment_refunded"] = {
  payment_intent_id: "pi_3Q0abcDEF123",
  order_id: ORDER_ID,
  user_id: USER_ID,
  refund_request_id: "d4c3b2a1-0f9e-4d8c-b7a6-5f4e3d2c1b0a",
  amount: { amount_minor: 11530000, currency: "DKK" },
  stripe_refund_id: "re_3Q0xyz789",
  refunded_at: "2026-10-14T10:32:30.000Z",
};
