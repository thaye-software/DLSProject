import type { Mailer } from "../mailer/mailer.js";
import { handleEvent, type EventHandler } from "../rabbitmq/consumer.js";
import { orderConfirmedDataSchema } from "./order-confirmation-schema.js";
import { sendOrderConfirmation } from "./order-confirmation-service.js";

// Handlers for order.events, keyed by CloudEvent type (= routing key).
export function orderConfirmationListener(mailer: Mailer): Record<string, EventHandler> {
  return {
    order_confirmed: handleEvent(orderConfirmedDataSchema, (order, event) => sendOrderConfirmation(order, event.id, mailer)),
  };
}
