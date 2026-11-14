import type { PaymentProvider } from "../payment-provider/payment-provider.js";
import { handleEvent, type EventHandler } from "../rabbitmq/consumer.js";
import { logger } from "../shared/logger.js";
import { refundRequestedDataSchema } from "./refund-payment-schema.js";
import { refundPayment } from "./refund-payment-service.js";

// Handlers for order.events, keyed by CloudEvent type (= routing key).
export function refundPaymentListener({ payments }: { payments: PaymentProvider }): Record<string, EventHandler> {
  return {
    refund_requested: handleEvent(refundRequestedDataSchema, async (request) => {
      const { refundId } = await refundPayment(
        { refundRequestId: request.refund_request_id, orderId: request.order_id, amount: request.amount },
        { payments },
      );
      logger.info({ orderId: request.order_id, refundId }, "Order refunded");
    }),
  };
}
