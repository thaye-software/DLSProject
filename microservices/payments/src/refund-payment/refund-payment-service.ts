import type { CreatedRefund, PaymentProvider } from "../payment-provider/payment-provider.js";
import type { RefundRequest } from "./refund-payment-types.js";

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
