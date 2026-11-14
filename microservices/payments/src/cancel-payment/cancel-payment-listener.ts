import type { PaymentProvider } from "../payment-provider/payment-provider.js";
import { handleEvent, type EventHandler } from "../rabbitmq/consumer.js";
import { logger } from "../shared/logger.js";
import { orderReferenceSchema } from "./cancel-payment-schema.js";
import { cancelPayment } from "./cancel-payment-service.js";

// Handlers for order.events, keyed by CloudEvent type (= routing key).
export function cancelPaymentListener({ payments }: { payments: PaymentProvider }): Record<string, EventHandler> {
  const cancelOrderPayment = handleEvent(orderReferenceSchema, async ({ order_id }, event) => {
    const outcome = await cancelPayment(order_id, { payments });
    logger.info({ eventId: event.id, eventType: event.type, orderId: order_id, outcome }, "Payment cancellation handled");
  });

  return {
    order_cancelled: cancelOrderPayment,
    order_expired: cancelOrderPayment,
  };
}
