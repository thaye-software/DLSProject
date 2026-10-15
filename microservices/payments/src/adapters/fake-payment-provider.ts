import type {
  CancelIntentResult,
  CreatedPaymentIntent,
  FoundPaymentIntent,
  NewPaymentIntent,
  PaymentProvider,
  RefundedPayment,
} from "../application/ports/payment-provider.js";

type FakeIntent = CreatedPaymentIntent & { userId: string; status: string };

const FINAL_STATUSES = new Set(["succeeded", "canceled"]);

export class FakePaymentProvider implements PaymentProvider {
  readonly intents = new Map<string, FakeIntent>();

  async createIntent({ orderId, userId, amount }: NewPaymentIntent): Promise<CreatedPaymentIntent> {
    const paymentIntentId = `pi_fake_${orderId.replaceAll("-", "")}`;
    const intent = {
      paymentIntentId,
      clientSecret: `${paymentIntentId}_secret_fake`,
      amount,
      userId,
      status: "requires_payment_method",
    };
    this.intents.set(orderId, intent);
    return intent;
  }

  async findIntentByOrderId(orderId: string): Promise<FoundPaymentIntent | null> {
    const intent = this.intents.get(orderId);
    return intent ? { id: intent.paymentIntentId, status: intent.status } : null;
  }

  async cancelIntent(paymentIntentId: string): Promise<CancelIntentResult> {
    const intent = [...this.intents.values()].find((candidate) => candidate.paymentIntentId === paymentIntentId);
    if (!intent) throw new Error(`No such payment_intent: ${paymentIntentId}`);
    if (FINAL_STATUSES.has(intent.status)) return "not_cancellable";
    intent.status = "canceled";
    return "cancelled";
  }

  async latestRefund(chargeId: string): Promise<RefundedPayment | null> {
    throw new Error(`FakePaymentProvider has no charges, so no refund for ${chargeId}`);
  }
}
