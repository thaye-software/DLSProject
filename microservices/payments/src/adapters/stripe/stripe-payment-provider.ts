import Stripe from "stripe";
import { z } from "zod";
import type {
  CreatedPaymentIntent,
  NewPaymentIntent,
  PaymentProvider,
  RefundedPayment,
} from "../../application/ports/payment-provider.js";
import { orderOwnerFrom, toOrderMetadata } from "./order-metadata.js";

const refundRequestIdSchema = z.uuid();

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
        metadata: toOrderMetadata({ orderId, userId }),
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

  async latestRefund(chargeId: string): Promise<RefundedPayment | null> {
    const {
      data: [refund],
    } = await this.stripe.refunds.list({ charge: chargeId, limit: 1, expand: ["data.payment_intent"] });
    if (!refund) throw new Error(`Stripe has no refund for charge ${chargeId}`);

    const intent = refund.payment_intent;
    if (!intent || typeof intent === "string") return null;
    const owner = orderOwnerFrom(intent.metadata);
    if (!owner) return null;

    const refundRequestId = refundRequestIdSchema.safeParse(refund.metadata?.refund_request_id);
    return {
      paymentIntentId: intent.id,
      ...owner,
      refundId: refund.id,
      refundRequestId: refundRequestId.success ? refundRequestId.data : null,
      amount: { amount_minor: refund.amount, currency: refund.currency.toUpperCase() },
      refundedAt: new Date(refund.created * 1000),
    };
  }
}
