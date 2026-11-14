import type { OrdersClient } from "../orders-client/orders-client.js";
import type { PaymentProvider } from "../payment-provider/payment-provider.js";
import { logger } from "../shared/logger.js";
import type { CreatePaymentSessionResult } from "./payment-session-types.js";

export type CreatePaymentSessionDependencies = {
  orders: OrdersClient;
  payments: PaymentProvider;
  now: () => Date;
};

const PAYABLE_STATUS = "RESERVED";

export async function createPaymentSession(
  { orderId, userId }: { orderId: string; userId: string },
  { orders, payments, now }: CreatePaymentSessionDependencies,
): Promise<CreatePaymentSessionResult> {
  const lookup = await orders.getPaymentDetails(orderId);
  if (lookup.kind !== "found") {
    logger.info({ orderId, ordersAnswer: lookup.kind }, "Payment refused: Orders did not return payable details");
    return { outcome: lookup.kind };
  }

  const { details } = lookup;
  if (details.user_id !== userId) {
    logger.info({ orderId, userId, orderUserId: details.user_id }, "Payment refused: order belongs to another user");
    return { outcome: "not_found" };
  }
  if (details.status !== PAYABLE_STATUS || new Date(details.expires_at) <= now()) {
    logger.info(
      { orderId, status: details.status, expiresAt: details.expires_at },
      "Payment refused: order is not RESERVED or has expired",
    );
    return { outcome: "not_payable" };
  }

  const intent = await payments.createIntent({ orderId, userId, amount: details.amount_due });
  return {
    outcome: "created",
    session: {
      payment_intent_id: intent.paymentIntentId,
      order_id: orderId,
      amount: intent.amount,
      client_secret: intent.clientSecret,
      expires_at: details.expires_at,
    },
  };
}
