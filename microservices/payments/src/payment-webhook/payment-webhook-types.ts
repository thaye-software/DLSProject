import type { NewPaymentEvent, PaymentEventType } from "../shared/payment-event.js";

export type PaymentWebhook = { [T in PaymentEventType]: NewPaymentEvent<T> }[PaymentEventType];
