import type { CreatedPaymentIntent, NewPaymentIntent, PaymentProvider, RefundedPayment } from "../application/ports/payment-provider.js";

export class FakePaymentProvider implements PaymentProvider {
  readonly intents = new Map<string, CreatedPaymentIntent & { userId: string }>();

  async createIntent({ orderId, userId, amount }: NewPaymentIntent): Promise<CreatedPaymentIntent> {
    const paymentIntentId = `pi_fake_${orderId.replaceAll("-", "")}`;
    const intent = { paymentIntentId, clientSecret: `${paymentIntentId}_secret_fake`, amount, userId };
    this.intents.set(orderId, intent);
    return intent;
  }

  async latestRefund(chargeId: string): Promise<RefundedPayment | null> {
    throw new Error(`FakePaymentProvider has no charges, so no refund for ${chargeId}`);
  }
}
