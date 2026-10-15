import { buildPaymentEvent, type NewPaymentEvent, type PaymentEventType } from "../domain/payment-event.js";
import type { EventPublisher } from "./ports/event-publisher.js";

export type PaymentWebhook = { [T in PaymentEventType]: NewPaymentEvent<T> }[PaymentEventType];

export async function handlePaymentWebhook(
  webhook: PaymentWebhook,
  { publisher }: { publisher: EventPublisher },
): Promise<void> {
  await publisher.publish(buildPaymentEvent(webhook));
}
