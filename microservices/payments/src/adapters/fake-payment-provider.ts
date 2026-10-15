import type { CreatedPaymentIntent, NewPaymentIntent, PaymentProvider } from "../application/ports/payment-provider.js";

export class FakePaymentProvider implements PaymentProvider {
  readonly intents = new Map<string, CreatedPaymentIntent & { userId: string }>();

  async createIntent({ orderId, userId, amount }: NewPaymentIntent): Promise<CreatedPaymentIntent> {
    const paymentIntentId = `pi_fake_${orderId.replaceAll("-", "")}`;
    const intent = { paymentIntentId, clientSecret: `${paymentIntentId}_secret_fake`, amount, userId };
    this.intents.set(orderId, intent);
    return intent;
  }
}
