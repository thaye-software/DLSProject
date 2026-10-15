import { renderOrderConfirmation, type OrderConfirmation } from "../domain/order-confirmation.js";
import type { Mailer } from "./ports/mailer.js";

export async function sendOrderConfirmation(order: OrderConfirmation, eventId: string, mailer: Mailer): Promise<void> {
  await mailer.send({ ...renderOrderConfirmation(order), idempotencyKey: eventId });
}
