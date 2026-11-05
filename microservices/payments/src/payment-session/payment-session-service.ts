import type { OrdersClient } from "../orders-client/orders-client.js";
import type { PaymentProvider } from "../payment-provider/payment-provider.js";
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
  if (lookup.kind !== "found") return { outcome: lookup.kind };

  const { details } = lookup;
  if (details.user_id !== userId) return { outcome: "not_found" };
  if (details.status !== PAYABLE_STATUS || new Date(details.expires_at) <= now()) {
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
