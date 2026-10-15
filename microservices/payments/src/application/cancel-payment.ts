import type { PaymentProvider } from "./ports/payment-provider.js";

export type CancelPaymentOutcome = "no_intent" | "already_canceled" | "already_paid" | "cancelled" | "not_cancellable";

export async function cancelPayment(
  orderId: string,
  { payments }: { payments: Pick<PaymentProvider, "findIntentByOrderId" | "cancelIntent"> },
): Promise<CancelPaymentOutcome> {
  const intent = await payments.findIntentByOrderId(orderId);
  if (!intent) return "no_intent";
  if (intent.status === "canceled") return "already_canceled";
  if (intent.status === "succeeded") return "already_paid";
  return payments.cancelIntent(intent.id);
}
