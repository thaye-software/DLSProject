import { z } from "zod";
import { cancelPayment } from "../../application/cancel-payment.js";
import type { PaymentProvider } from "../../application/ports/payment-provider.js";
import { handleEvent, type EventHandler } from "./consumer.js";

export const orderReferenceSchema = z.object({ order_id: z.uuid() });

export function createOrderEventHandlers({ payments }: { payments: PaymentProvider }): Record<string, EventHandler> {
  const cancelOrderPayment = handleEvent(orderReferenceSchema, async ({ order_id }, event) => {
    const outcome = await cancelPayment(order_id, { payments });
    console.log(`${event.type} ${event.id}: PaymentIntent for order ${order_id} ${outcome}`);
  });

  return {
    order_cancelled: cancelOrderPayment,
    order_expired: cancelOrderPayment,
  };
}
