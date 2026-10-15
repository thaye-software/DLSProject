import type { Money } from "../domain/money.js";
import type { CreatedRefund, PaymentProvider } from "./ports/payment-provider.js";

export type RefundRequest = {
  refundRequestId: string;
  orderId: string;
  amount: Money;
};

export async function refundPayment(
  { refundRequestId, orderId, amount }: RefundRequest,
  { payments }: { payments: Pick<PaymentProvider, "findIntentByOrderId" | "refund"> },
): Promise<CreatedRefund> {
  const intent = await payments.findIntentByOrderId(orderId);
  if (!intent) throw new Error(`No PaymentIntent found for order ${orderId}`);
  if (intent.status !== "succeeded") {
    throw new Error(`PaymentIntent ${intent.id} for order ${orderId} is ${intent.status}, not succeeded`);
  }
  return payments.refund({ paymentIntentId: intent.id, amount, refundRequestId });
}
