import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { createStripeWebhookHandler } from "../../src/adapters/http/stripe-webhook.js";
import { StripePaymentProvider } from "../../src/adapters/stripe/stripe-payment-provider.js";
import { handlePaymentWebhook } from "../../src/application/handle-payment-webhook.js";
import type { PaymentEvent } from "../../src/domain/payment-event.js";
import { contractSchema } from "../support/contract.js";
import { serve } from "../support/serve.js";

const secretKey = process.env.STRIPE_SECRET_KEY;
const isTestModeKey = secretKey?.startsWith("sk_test_") ?? false;
const WEBHOOK_SECRET = "whsec_integration_test_secret";
const AMOUNT = { amount_minor: 11530000, currency: "DKK" };

async function startCheckout() {
  const provider = new StripePaymentProvider(secretKey!);
  const order = { orderId: randomUUID(), userId: randomUUID(), amount: AMOUNT };
  const intent = await provider.createIntent(order);
  return { provider, order, paymentIntentId: intent.paymentIntentId };
}

// Stripe.js confirms in the browser; a test card confirmed on the server reaches the same PaymentIntent states.
async function payWith(paymentIntentId: string, paymentMethod: string) {
  await new Stripe(secretKey!).paymentIntents
    .confirm(paymentIntentId, { payment_method: paymentMethod, return_url: "https://limitedwatches.dk/checkout/complete" })
    .catch((error: unknown) => {
      if (!(error instanceof Stripe.errors.StripeCardError)) throw error;
    });
}

// Stripe can only deliver webhooks to a public URL, so the test fetches the real event and signs it with its own secret.
async function stripeEventFor(type: string, paymentIntentId: string, since: number): Promise<Stripe.Event> {
  const stripe = new Stripe(secretKey!);
  return vi.waitFor(
    async () => {
      const { data } = await stripe.events.list({ type, created: { gte: since }, limit: 100 });
      const event = data.find((candidate) => (candidate.data.object as { id?: string }).id === paymentIntentId);
      if (!event) throw new Error(`Stripe has no ${type} event for ${paymentIntentId} yet`);
      return event;
    },
    { timeout: 30_000, interval: 1000 },
  );
}

async function deliver(event: Stripe.Event, provider: StripePaymentProvider) {
  const published: PaymentEvent[] = [];
  const stripeWebhook = createStripeWebhookHandler({
    webhookSecret: WEBHOOK_SECRET,
    payments: provider,
    handlePaymentWebhook: (webhook) => handlePaymentWebhook(webhook, { publisher: { publish: async (e) => void published.push(e) } }),
  });
  const baseUrl = await serve({ stripeWebhook });
  const body = JSON.stringify(event);
  const response = await fetch(`${baseUrl}/webhooks/stripe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }),
    },
    body,
  });
  return { response, published };
}

describe.skipIf(!isTestModeKey)("Stripe webhook with real Stripe test-mode events", () => {
  it("a PaymentIntent from POST /payments paid with a test card becomes a valid DKK payment_complete", async () => {
    const since = Math.floor(Date.now() / 1000) - 5;
    const { provider, order, paymentIntentId } = await startCheckout();
    await payWith(paymentIntentId, "pm_card_visa");

    const { response, published } = await deliver(await stripeEventFor("payment_intent.succeeded", paymentIntentId, since), provider);

    expect(response.status).toBe(200);
    expect(published).toHaveLength(1);
    expect(published[0]!.data).toMatchObject({
      payment_intent_id: paymentIntentId,
      order_id: order.orderId,
      user_id: order.userId,
      amount: AMOUNT,
    });
    const validate = contractSchema("PaymentCompleteEvent");
    expect(validate(published[0]), JSON.stringify(validate.errors)).toBe(true);
  });

  it("a declined test card becomes a valid payment_failed with Stripe's decline code", async () => {
    const since = Math.floor(Date.now() / 1000) - 5;
    const { provider, order, paymentIntentId } = await startCheckout();
    await payWith(paymentIntentId, "pm_card_chargeDeclined");

    const { response, published } = await deliver(await stripeEventFor("payment_intent.payment_failed", paymentIntentId, since), provider);

    expect(response.status).toBe(200);
    expect(published).toHaveLength(1);
    expect(published[0]!.data).toMatchObject({
      payment_intent_id: paymentIntentId,
      order_id: order.orderId,
      amount: AMOUNT,
      failure_code: "card_declined",
    });
    const validate = contractSchema("PaymentFailedEvent");
    expect(validate(published[0]), JSON.stringify(validate.errors)).toBe(true);
  });
});
