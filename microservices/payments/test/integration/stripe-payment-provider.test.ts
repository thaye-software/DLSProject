import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, describe, expect, it } from "vitest";
import { StripePaymentProvider } from "../../src/adapters/stripe/stripe-payment-provider.js";

const secretKey = process.env.STRIPE_SECRET_KEY;
const isTestModeKey = secretKey?.startsWith("sk_test_") ?? false;

const createdIntentIds: string[] = [];

afterAll(async () => {
  if (!isTestModeKey) return;
  const stripe = new Stripe(secretKey!);
  await Promise.all(createdIntentIds.map((id) => stripe.paymentIntents.cancel(id).catch(() => undefined)));
});

describe.skipIf(!isTestModeKey)("StripePaymentProvider (Stripe test mode)", () => {
  it("creates a DKK PaymentIntent that carries the order and user ids", async () => {
    const provider = new StripePaymentProvider(secretKey!);
    const orderId = randomUUID();
    const userId = randomUUID();

    const intent = await provider.createIntent({ orderId, userId, amount: { amount_minor: 11530000, currency: "DKK" } });
    createdIntentIds.push(intent.paymentIntentId);

    expect(intent.paymentIntentId).toMatch(/^pi_/);
    expect(intent.clientSecret).toMatch(new RegExp(`^${intent.paymentIntentId}_secret_`));
    expect(intent.amount).toEqual({ amount_minor: 11530000, currency: "DKK" });
    const stored = await new Stripe(secretKey!).paymentIntents.retrieve(intent.paymentIntentId);
    expect(stored).toMatchObject({
      amount: 11530000,
      currency: "dkk",
      metadata: { order_id: orderId, user_id: userId },
      automatic_payment_methods: { enabled: true },
    });
  });

  it("returns the same PaymentIntent when called again for the same order", async () => {
    const provider = new StripePaymentProvider(secretKey!);
    const order = { orderId: randomUUID(), userId: randomUUID(), amount: { amount_minor: 30000, currency: "DKK" } };

    const first = await provider.createIntent(order);
    const second = await provider.createIntent(order);
    createdIntentIds.push(first.paymentIntentId);

    expect(second.paymentIntentId).toBe(first.paymentIntentId);
    expect(second.clientSecret).toBe(first.clientSecret);
  });

  describe("latestRefund", () => {
    async function paidCharge(metadata: Record<string, string>): Promise<{ paymentIntentId: string; chargeId: string }> {
      const intent = await new Stripe(secretKey!).paymentIntents.create({
        amount: 30000,
        currency: "dkk",
        payment_method: "pm_card_visa",
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata,
      });
      return { paymentIntentId: intent.id, chargeId: intent.latest_charge as string };
    }

    it("describes a refund without a refund request id", async () => {
      const orderId = randomUUID();
      const userId = randomUUID();
      const { paymentIntentId, chargeId } = await paidCharge({ order_id: orderId, user_id: userId });
      const refund = await new Stripe(secretKey!).refunds.create({ payment_intent: paymentIntentId });

      const described = await new StripePaymentProvider(secretKey!).latestRefund(chargeId);

      expect(described).toEqual({
        paymentIntentId,
        orderId,
        userId,
        refundId: refund.id,
        refundRequestId: null,
        amount: { amount_minor: 30000, currency: "DKK" },
        refundedAt: new Date(refund.created * 1000),
      });
    });

    it("describes the newest of several partial refunds, with its refund request id", async () => {
      const stripe = new Stripe(secretKey!);
      const { paymentIntentId, chargeId } = await paidCharge({ order_id: randomUUID(), user_id: randomUUID() });
      await stripe.refunds.create({ payment_intent: paymentIntentId, amount: 10000 });
      // Stripe orders lists by `created`, which has one-second resolution.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const refundRequestId = randomUUID();
      const newest = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: 5000,
        metadata: { refund_request_id: refundRequestId },
      });

      const described = await new StripePaymentProvider(secretKey!).latestRefund(chargeId);

      expect(described).toMatchObject({
        refundId: newest.id,
        refundRequestId,
        amount: { amount_minor: 5000, currency: "DKK" },
      });
    });

    it("returns null for a payment Payment did not create", async () => {
      const { paymentIntentId, chargeId } = await paidCharge({ internal_order_id: "42" });
      await new Stripe(secretKey!).refunds.create({ payment_intent: paymentIntentId });

      expect(await new StripePaymentProvider(secretKey!).latestRefund(chargeId)).toBeNull();
    });
  });

  it("throws when Stripe rejects the key", async () => {
    const provider = new StripePaymentProvider("sk_test_invalid_key_for_tests");

    await expect(
      provider.createIntent({ orderId: randomUUID(), userId: randomUUID(), amount: { amount_minor: 100, currency: "DKK" } }),
    ).rejects.toThrow();
  });
});
