import type { PaymentEvent } from "../shared/payment-event.js";

export type EventPublisher = {
  publish(event: PaymentEvent): Promise<void>;
};
