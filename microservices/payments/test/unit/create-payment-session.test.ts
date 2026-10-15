import { describe, expect, it } from "vitest";
import { FakePaymentProvider } from "../../src/adapters/fake-payment-provider.js";
import { createPaymentSession } from "../../src/application/create-payment-session.js";
import type { OrdersClient, PaymentDetails, PaymentDetailsLookup } from "../../src/application/ports/orders-client.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const OWNER = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
const SOMEONE_ELSE = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const NOW = new Date("2026-10-14T10:10:00Z");

function details(overrides: Partial<PaymentDetails> = {}): PaymentDetails {
  return {
    order_id: ORDER_ID,
    user_id: OWNER,
    status: "RESERVED",
    amount_due: { amount_minor: 11530000, currency: "DKK" },
    expires_at: "2026-10-14T10:30:00Z",
    ...overrides,
  };
}

function ordersReturning(lookup: PaymentDetailsLookup): OrdersClient {
  return { getPaymentDetails: async () => lookup };
}

async function run(lookup: PaymentDetailsLookup, userId = OWNER) {
  const payments = new FakePaymentProvider();
  const result = await createPaymentSession(
    { orderId: ORDER_ID, userId },
    { orders: ordersReturning(lookup), payments, now: () => NOW },
  );
  return { result, payments };
}

describe("createPaymentSession", () => {
  it("R5: a reserved, unexpired order owned by the caller gets a session for its amount", async () => {
    const { result, payments } = await run({ kind: "found", details: details() });

    expect(result).toEqual({
      outcome: "created",
      session: {
        payment_intent_id: `pi_fake_${ORDER_ID.replaceAll("-", "")}`,
        order_id: ORDER_ID,
        amount: { amount_minor: 11530000, currency: "DKK" },
        client_secret: `pi_fake_${ORDER_ID.replaceAll("-", "")}_secret_fake`,
        expires_at: "2026-10-14T10:30:00Z",
      },
    });
    expect(payments.intents.get(ORDER_ID)).toMatchObject({
      userId: OWNER,
      amount: { amount_minor: 11530000, currency: "DKK" },
    });
  });

  it.each([
    { name: "R1: Orders does not know the order → not found", lookup: { kind: "not_found" } as const, userId: OWNER, outcome: "not_found" },
    { name: "R2: another user's order → not found", lookup: { kind: "found", details: details() } as const, userId: SOMEONE_ELSE, outcome: "not_found" },
    { name: "R2: another user's unpayable order → not found, not 'not payable'", lookup: { kind: "found", details: details({ status: "PENDING" }) } as const, userId: SOMEONE_ELSE, outcome: "not_found" },
    { name: "R3: Orders says not payable → not payable", lookup: { kind: "not_payable" } as const, userId: OWNER, outcome: "not_payable" },
    { name: "R3: status PENDING (EP) → not payable", lookup: { kind: "found", details: details({ status: "PENDING" }) } as const, userId: OWNER, outcome: "not_payable" },
    { name: "R3: status EXPIRED (EP) → not payable", lookup: { kind: "found", details: details({ status: "EXPIRED" }) } as const, userId: OWNER, outcome: "not_payable" },
    { name: "R3: status CANCELLED (EP) → not payable", lookup: { kind: "found", details: details({ status: "CANCELLED" }) } as const, userId: OWNER, outcome: "not_payable" },
  ])("$name, and no PaymentIntent is created", async ({ lookup, userId, outcome }) => {
    const { result, payments } = await run(lookup, userId);

    expect(result).toEqual({ outcome });
    expect(payments.intents.size).toBe(0);
  });

  it.each([
    { name: "expires one second from now (BV)", expiresAt: "2026-10-14T10:10:01Z", outcome: "created" },
    { name: "expires exactly now (BV)", expiresAt: "2026-10-14T10:10:00Z", outcome: "not_payable" },
    { name: "expired one second ago (BV)", expiresAt: "2026-10-14T10:09:59Z", outcome: "not_payable" },
  ])("R4: reservation $name → $outcome", async ({ expiresAt, outcome }) => {
    const { result } = await run({ kind: "found", details: details({ expires_at: expiresAt }) });

    expect(result.outcome).toBe(outcome);
  });

  it("fails when Orders cannot be reached", async () => {
    const orders: OrdersClient = { getPaymentDetails: async () => Promise.reject(new Error("Orders is down")) };

    await expect(
      createPaymentSession({ orderId: ORDER_ID, userId: OWNER }, { orders, payments: new FakePaymentProvider(), now: () => NOW }),
    ).rejects.toThrow("Orders is down");
  });
});
