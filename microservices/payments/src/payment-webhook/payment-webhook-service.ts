import type { EventPublisher } from "../rabbitmq/event-publisher.js";
import { buildPaymentEvent } from "../shared/payment-event.js";
import type { PaymentWebhook } from "./payment-webhook-types.js";

export async function handlePaymentWebhook(
  webhook: PaymentWebhook,
  { publisher }: { publisher: EventPublisher },
): Promise<void> {
  await publisher.publish(buildPaymentEvent(webhook));
}
