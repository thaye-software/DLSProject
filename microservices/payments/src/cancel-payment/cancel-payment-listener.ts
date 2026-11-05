import type { PaymentProvider } from "../payment-provider/payment-provider.js";
import { handleEvent, type EventHandler } from "../rabbitmq/consumer.js";
import { orderReferenceSchema } from "./cancel-payment-schema.js";
import { cancelPayment } from "./cancel-payment-service.js";

// Handlers for order.events, keyed by CloudEvent type (= routing key).
export function cancelPaymentListener({ payments }: { payments: PaymentProvider }): Record<string, EventHandler> {
  const cancelOrderPayment = handleEvent(orderReferenceSchema, async ({ order_id }, event) => {
    const outcome = await cancelPayment(order_id, { payments });
    console.log(`${event.type} ${event.id}: PaymentIntent for order ${order_id} ${outcome}`);
  });

  return {
    order_cancelled: cancelOrderPayment,
    order_expired: cancelOrderPayment,
  };
}
