import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { StripePaymentProvider } from "../../src/adapters/stripe/stripe-payment-provider.js";
import { cancelPayment } from "../../src/application/cancel-payment.js";

const secretKey = process.env.STRIPE_SECRET_KEY;
const isTestModeKey = secretKey?.startsWith("sk_test_") ?? false;
// Stripe documents that Search can lag behind writes by up to a minute, and a hit can disappear again on the next query while it catches up.
const SEARCH_LAG = { timeout: 60_000, interval: 2000 };

describe.skipIf(!isTestModeKey)("cancelPayment (Stripe test mode)", () => {
  it(
    "cancels the PaymentIntent of an expired order, and does nothing the second time",
    async () => {
      const payments = new StripePaymentProvider(secretKey!);
      const orderId = randomUUID();
      const intent = await payments.createIntent({ orderId, userId: randomUUID(), amount: { amount_minor: 11530000, currency: "DKK" } });
      await vi.waitFor(async () => expect(await cancelPayment(orderId, { payments })).toBe("cancelled"), SEARCH_LAG);

      expect((await new Stripe(secretKey!).paymentIntents.retrieve(intent.paymentIntentId)).status).toBe("canceled");
      await vi.waitFor(async () => expect(await cancelPayment(orderId, { payments })).toBe("already_canceled"), SEARCH_LAG);
    },
    150_000,
  );
});
