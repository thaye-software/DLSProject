import type { Mailer } from "../mailer/mailer.js";
import { renderOrderConfirmation } from "./order-confirmation-template.js";
import type { OrderConfirmation } from "./order-confirmation-types.js";

export async function sendOrderConfirmation(order: OrderConfirmation, eventId: string, mailer: Mailer): Promise<void> {
  await mailer.send({ ...renderOrderConfirmation(order), idempotencyKey: eventId });
}
