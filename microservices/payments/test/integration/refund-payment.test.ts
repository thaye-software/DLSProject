import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { StripePaymentProvider } from "../../src/adapters/stripe/stripe-payment-provider.js";
import { refundPayment } from "../../src/application/refund-payment.js";

const secretKey = process.env.STRIPE_SECRET_KEY;
const isTestModeKey = secretKey?.startsWith("sk_test_") ?? false;
// Stripe documents that Search can lag behind writes by up to a minute, and a hit can disappear again on the next query while it catches up.
const SEARCH_LAG = { timeout: 60_000, interval: 2000 };
const PAID = { amount_minor: 11530000, currency: "DKK" };

describe.skipIf(!isTestModeKey)("refundPayment (Stripe test mode)", () => {
  it(
    "refunds a card payment once, with the refund request id the charge.refunded webhook reads back",
    async () => {
      const stripe = new Stripe(secretKey!);
      const payments = new StripePaymentProvider(secretKey!);
      const orderId = randomUUID();
      const { paymentIntentId } = await payments.createIntent({ orderId, userId: randomUUID(), amount: PAID });
      const paid = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: "pm_card_visa",
        return_url: "https://limitedwatches.dk/checkout/complete",
      });
      const request = { refundRequestId: randomUUID(), orderId, amount: PAID };

      const first = await vi.waitFor(() => refundPayment(request, { payments }), SEARCH_LAG);
      const second = await vi.waitFor(() => refundPayment(request, { payments }), SEARCH_LAG);

      expect(second).toEqual(first);
      const { data: refunds } = await stripe.refunds.list({ payment_intent: paymentIntentId });
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({
        id: first.refundId,
        amount: PAID.amount_minor,
        currency: "dkk",
        metadata: { refund_request_id: request.refundRequestId },
      });
      expect(await payments.latestRefund(paid.latest_charge as string)).toMatchObject({
        refundId: first.refundId,
        refundRequestId: request.refundRequestId,
        orderId,
      });
    },
    150_000,
  );
});
