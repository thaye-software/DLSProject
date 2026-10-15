import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { createStripeWebhookHandler } from "../../src/adapters/http/stripe-webhook.js";
import { handlePaymentWebhook } from "../../src/application/handle-payment-webhook.js";
import type { EventPublisher } from "../../src/application/ports/event-publisher.js";
import type { PaymentProvider, RefundedPayment } from "../../src/application/ports/payment-provider.js";
import type { PaymentEvent } from "../../src/domain/payment-event.js";
import { serve } from "../support/serve.js";

const WEBHOOK_SECRET = "whsec_unit_test_secret";
const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
const REFUND_REQUEST_ID = "d4c3b2a1-0f9e-4d8c-b7a6-5f4e3d2c1b0a";
const CHARGE_ID = "ch_3Q0abcDEF123";
const EVENT_CREATED = "2026-10-14T10:04:08.000Z";

function stripeEvent(type: string, object: object, id = "evt_3Q0abc") {
  return { id, object: "event", type, created: Date.parse(EVENT_CREATED) / 1000, livemode: false, data: { object } };
}

function paymentIntent(overrides: object = {}) {
  return {
    id: "pi_3Q0abcDEF123",
    object: "payment_intent",
    amount: 11530000,
    amount_received: 11530000,
    currency: "dkk",
    metadata: { order_id: ORDER_ID, user_id: USER_ID },
    last_payment_error: null,
    ...overrides,
  };
}

const charge = { id: CHARGE_ID, object: "charge", payment_intent: "pi_3Q0abcDEF123", refunded: true };

const refundedPayment: RefundedPayment = {
  paymentIntentId: "pi_3Q0abcDEF123",
  orderId: ORDER_ID,
  userId: USER_ID,
  refundId: "re_3Q0xyz789",
  refundRequestId: REFUND_REQUEST_ID,
  amount: { amount_minor: 11530000, currency: "DKK" },
  refundedAt: new Date("2026-10-14T10:32:30Z"),
};

type Setup = {
  publish?: EventPublisher["publish"];
  latestRefund?: PaymentProvider["latestRefund"];
};

async function webhookServer({ publish, latestRefund }: Setup = {}) {
  const published: PaymentEvent[] = [];
  const publisher: EventPublisher = { publish: publish ?? (async (event) => void published.push(event)) };
  const payments = {
    latestRefund:
      latestRefund ??
      (async (chargeId: string) => {
        if (chargeId !== CHARGE_ID) throw new Error(`No such charge: ${chargeId}`);
        return refundedPayment;
      }),
  };
  const stripeWebhook = createStripeWebhookHandler({
    webhookSecret: WEBHOOK_SECRET,
    payments,
    handlePaymentWebhook: (webhook) => handlePaymentWebhook(webhook, { publisher }),
  });
  const baseUrl = await serve({ stripeWebhook });

  const deliver = (body: string, signature: string | null = sign(body)) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (signature !== null) headers["stripe-signature"] = signature;
    return fetch(`${baseUrl}/webhooks/stripe`, { method: "POST", headers, body });
  };
  return { deliver, published };
}

function sign(body: string, { secret = WEBHOOK_SECRET, timestamp }: { secret?: string; timestamp?: number } = {}) {
  return Stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp });
}

describe("POST /webhooks/stripe", () => {
  describe("signature", () => {
    const body = JSON.stringify(stripeEvent("payment_intent.succeeded", paymentIntent()));
    const nowSeconds = () => Math.floor(Date.now() / 1000);

    it("accepts a payload signed with the webhook secret", async () => {
      const { deliver } = await webhookServer();

      expect((await deliver(body)).status).toBe(200);
    });

    it.each([
      { name: "a body changed after signing", send: () => ({ body: body.replace("11530000", "100"), signature: sign(body) }) },
      { name: "a signature from another secret", send: () => ({ body, signature: sign(body, { secret: "whsec_someone_else" }) }) },
      { name: "no Stripe-Signature header", send: () => ({ body, signature: null }) },
      { name: "a signature older than Stripe's 5 minute tolerance (BV)", send: () => ({ body, signature: sign(body, { timestamp: nowSeconds() - 301 }) }) },
    ])("rejects $name with 400 problem+json and publishes nothing", async ({ send }) => {
      const { deliver, published } = await webhookServer();
      const { body: sent, signature } = send();

      const response = await deliver(sent, signature);

      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
      expect(await response.json()).toMatchObject({
        type: "https://limitedwatches.dk/problems/invalid_signature",
        title: "Invalid signature",
        status: 400,
        instance: "/webhooks/stripe",
      });
      expect(published).toEqual([]);
    });

    it("accepts a signature just inside the tolerance (BV)", async () => {
      const { deliver } = await webhookServer();

      expect((await deliver(body, sign(body, { timestamp: nowSeconds() - 290 }))).status).toBe(200);
    });
  });

  it.each([
    {
      name: "R1: payment_intent.succeeded → payment_complete",
      event: stripeEvent("payment_intent.succeeded", paymentIntent({ amount_received: 11530000 })),
      type: "payment_complete",
      data: {
        payment_intent_id: "pi_3Q0abcDEF123",
        order_id: ORDER_ID,
        user_id: USER_ID,
        amount: { amount_minor: 11530000, currency: "DKK" },
        paid_at: EVENT_CREATED,
      },
    },
    {
      name: "R2: payment_intent.payment_failed with an error → payment_failed with its code and message",
      event: stripeEvent(
        "payment_intent.payment_failed",
        paymentIntent({ amount_received: 0, last_payment_error: { code: "card_declined", message: "Your card was declined." } }),
      ),
      type: "payment_failed",
      data: {
        payment_intent_id: "pi_3Q0abcDEF123",
        order_id: ORDER_ID,
        user_id: USER_ID,
        amount: { amount_minor: 11530000, currency: "DKK" },
        failure_code: "card_declined",
        failure_message: "Your card was declined.",
        failed_at: EVENT_CREATED,
      },
    },
    {
      name: "R3: payment_intent.payment_failed without an error → payment_failed with null code and message",
      event: stripeEvent("payment_intent.payment_failed", paymentIntent({ amount_received: 0, last_payment_error: null })),
      type: "payment_failed",
      data: {
        payment_intent_id: "pi_3Q0abcDEF123",
        order_id: ORDER_ID,
        user_id: USER_ID,
        amount: { amount_minor: 11530000, currency: "DKK" },
        failure_code: null,
        failure_message: null,
        failed_at: EVENT_CREATED,
      },
    },
    {
      name: "R4: charge.refunded → payment_refunded from the charge's latest refund",
      event: stripeEvent("charge.refunded", charge),
      type: "payment_refunded",
      data: {
        payment_intent_id: "pi_3Q0abcDEF123",
        order_id: ORDER_ID,
        user_id: USER_ID,
        refund_request_id: REFUND_REQUEST_ID,
        amount: { amount_minor: 11530000, currency: "DKK" },
        stripe_refund_id: "re_3Q0xyz789",
        refunded_at: "2026-10-14T10:32:30.000Z",
      },
    },
  ])("$name, answering 200", async ({ event, type, data }) => {
    const { deliver, published } = await webhookServer();

    const response = await deliver(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ type, subject: ORDER_ID, correlationid: ORDER_ID, time: EVENT_CREATED });
    expect(published[0]!.data).toEqual(data);
  });

  it("R5: a refund without a refund request id → payment_refunded with a null refund_request_id", async () => {
    const { deliver, published } = await webhookServer({
      latestRefund: async () => ({ ...refundedPayment, refundRequestId: null }),
    });

    await deliver(JSON.stringify(stripeEvent("charge.refunded", charge)));

    expect(published[0]!.data).toMatchObject({ refund_request_id: null });
  });

  it.each([
    { name: "R6: a type Payment does not handle (customer.created)", event: stripeEvent("customer.created", { id: "cus_1", object: "customer" }) },
    { name: "R7: a PaymentIntent without our metadata (monolith's internal_order_id)", event: stripeEvent("payment_intent.succeeded", paymentIntent({ metadata: { internal_order_id: "42" } })) },
    { name: "R7: a PaymentIntent whose order_id is not a UUID", event: stripeEvent("payment_intent.payment_failed", paymentIntent({ metadata: { order_id: "42", user_id: USER_ID } })) },
    { name: "R8: a refund of a payment that is not ours", event: stripeEvent("charge.refunded", charge), latestRefund: async () => null },
  ])("$name → 200 and nothing published", async ({ event, latestRefund }) => {
    const { deliver, published } = await webhookServer({ latestRefund });

    const response = await deliver(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(published).toEqual([]);
  });

  it("publishes a redelivered Stripe event again with the same CloudEvent id, so Orders can skip it", async () => {
    const { deliver, published } = await webhookServer();
    const body = JSON.stringify(stripeEvent("payment_intent.succeeded", paymentIntent()));

    await deliver(body);
    await deliver(body);

    expect(published).toHaveLength(2);
    expect(published[1]!.id).toBe(published[0]!.id);
  });

  it.each([
    {
      name: "RabbitMQ does not confirm the publish",
      event: stripeEvent("payment_intent.succeeded", paymentIntent()),
      setup: { publish: () => Promise.reject(new Error("message nacked")) },
    },
    {
      name: "Stripe cannot be asked for the refund",
      event: stripeEvent("charge.refunded", charge),
      setup: { latestRefund: () => Promise.reject(new Error("Stripe is down")) },
    },
  ])("answers 500 when $name, so Stripe retries", async ({ event, setup }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { deliver } = await webhookServer(setup);

    const response = await deliver(JSON.stringify(event));

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  });

  it("is not served when no webhook handler is configured (fake payment provider)", async () => {
    const baseUrl = await serve();

    const response = await fetch(`${baseUrl}/webhooks/stripe`, { method: "POST", body: "{}" });

    expect(response.status).toBe(404);
  });
});
