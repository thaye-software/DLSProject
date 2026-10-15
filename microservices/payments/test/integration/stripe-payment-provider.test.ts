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

  it("throws when Stripe rejects the key", async () => {
    const provider = new StripePaymentProvider("sk_test_invalid_key_for_tests");

    await expect(
      provider.createIntent({ orderId: randomUUID(), userId: randomUUID(), amount: { amount_minor: 100, currency: "DKK" } }),
    ).rejects.toThrow();
  });
});
