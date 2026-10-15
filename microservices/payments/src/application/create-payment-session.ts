import type { Money } from "../domain/money.js";
import type { OrdersClient } from "./ports/orders-client.js";
import type { PaymentProvider } from "./ports/payment-provider.js";

export type PaymentSession = {
  payment_intent_id: string;
  order_id: string;
  amount: Money;
  client_secret: string;
  expires_at: string;
};

export type CreatePaymentSessionResult =
  | { outcome: "created"; session: PaymentSession }
  | { outcome: "not_found" }
  | { outcome: "not_payable" };

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
