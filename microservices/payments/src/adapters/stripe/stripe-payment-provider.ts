import Stripe from "stripe";
import type { CreatedPaymentIntent, NewPaymentIntent, PaymentProvider } from "../../application/ports/payment-provider.js";

export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createIntent({ orderId, userId, amount }: NewPaymentIntent): Promise<CreatedPaymentIntent> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: amount.amount_minor,
        currency: amount.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: { order_id: orderId, user_id: userId },
      },
      { idempotencyKey: orderId },
    );
    if (!intent.client_secret) throw new Error(`Stripe returned PaymentIntent ${intent.id} without a client secret`);

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amount: { amount_minor: intent.amount, currency: intent.currency.toUpperCase() },
    };
  }
}
