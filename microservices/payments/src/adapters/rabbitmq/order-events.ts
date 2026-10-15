import { z } from "zod";
import { cancelPayment } from "../../application/cancel-payment.js";
import type { PaymentProvider } from "../../application/ports/payment-provider.js";
import { refundPayment } from "../../application/refund-payment.js";
import { handleEvent, type EventHandler } from "./consumer.js";

export const orderReferenceSchema = z.object({ order_id: z.uuid() });

export const refundRequestedDataSchema = z.object({
  refund_request_id: z.uuid(),
  order_id: z.uuid(),
  amount: z.object({
    amount_minor: z.number().int().min(1),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
});

export function createOrderEventHandlers({ payments }: { payments: PaymentProvider }): Record<string, EventHandler> {
  const cancelOrderPayment = handleEvent(orderReferenceSchema, async ({ order_id }, event) => {
    const outcome = await cancelPayment(order_id, { payments });
    console.log(`${event.type} ${event.id}: PaymentIntent for order ${order_id} ${outcome}`);
  });

  const refundOrderPayment = handleEvent(refundRequestedDataSchema, async (request, event) => {
    const { refundId } = await refundPayment(
      { refundRequestId: request.refund_request_id, orderId: request.order_id, amount: request.amount },
      { payments },
    );
    console.log(`${event.type} ${event.id}: refunded order ${request.order_id} as ${refundId}`);
  });

  return {
    order_cancelled: cancelOrderPayment,
    order_expired: cancelOrderPayment,
    refund_requested: refundOrderPayment,
  };
}
