import type { PaymentEvent } from "../../domain/payment-event.js";

export type EventPublisher = {
  publish(event: PaymentEvent): Promise<void>;
};
