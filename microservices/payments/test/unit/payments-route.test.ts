import { describe, expect, it, vi } from "vitest";
import type { CreatePaymentSessionResult } from "../../src/application/create-payment-session.js";
import { serve } from "../support/serve.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";

const session = {
  payment_intent_id: "pi_3Q0abcDEF123",
  order_id: ORDER_ID,
  amount: { amount_minor: 11530000, currency: "DKK" },
  client_secret: "pi_3Q0abcDEF123_secret_XYZ",
  expires_at: "2026-10-14T10:30:00Z",
};

type Call = { body?: string; userId?: string | null; result?: CreatePaymentSessionResult | Error };

async function postPayment({ body = JSON.stringify({ order_id: ORDER_ID }), userId = USER_ID, result }: Call = {}) {
  const createPaymentSession = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result ?? { outcome: "created" as const, session };
  });
  const baseUrl = await serve({ createPaymentSession });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId !== null) headers["x-user-id"] = userId;
  const response = await fetch(`${baseUrl}/payments`, { method: "POST", headers, body });
  return { response, createPaymentSession };
}

async function expectProblem(response: Response, status: number, problem: Record<string, unknown>) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  expect(await response.json()).toMatchObject({ status, instance: "/payments", ...problem });
}

describe("POST /payments", () => {
  it("answers 201 with the payment session for the caller's order", async () => {
    const { response, createPaymentSession } = await postPayment();

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(session);
    expect(createPaymentSession).toHaveBeenCalledExactlyOnceWith({ orderId: ORDER_ID, userId: USER_ID });
  });

  it("answers 404 problem+json when the order is not found or not the caller's", async () => {
    const { response } = await postPayment({ result: { outcome: "not_found" } });

    await expectProblem(response, 404, {
      type: "https://limitedwatches.dk/problems/not_found",
      title: "Order not found",
      detail: "Order not found.",
    });
  });

  it("answers 409 problem+json when the order is not payable", async () => {
    const { response } = await postPayment({ result: { outcome: "not_payable" } });

    await expectProblem(response, 409, {
      type: "https://limitedwatches.dk/problems/order_not_payable",
      title: "Order is not payable (not RESERVED or expired)",
      detail: "Order is not payable (not RESERVED or expired).",
    });
  });

  it("answers 502 problem+json when Orders or Stripe fails", async () => {
    const { response } = await postPayment({ result: new Error("Stripe is down") });

    await expectProblem(response, 502, {
      type: "https://limitedwatches.dk/problems/upstream_unavailable",
      title: "Payment could not be started",
    });
  });

  it.each([
    { name: "X-User-Id missing (EP)", userId: null },
    { name: "X-User-Id empty (EP)", userId: "" },
    { name: "X-User-Id not a uuid (EP)", userId: "mette" },
  ])("$name → 401 problem+json and nothing started", async ({ userId }) => {
    const { response, createPaymentSession } = await postPayment({ userId });

    await expectProblem(response, 401, { type: "https://limitedwatches.dk/problems/unauthenticated" });
    expect(createPaymentSession).not.toHaveBeenCalled();
  });

  it.each([
    { name: "order_id missing (EP)", body: JSON.stringify({}) },
    { name: "order_id not a uuid (EP)", body: JSON.stringify({ order_id: "abc" }) },
    { name: "unknown field (EP)", body: JSON.stringify({ order_id: ORDER_ID, amount: 1 }) },
    { name: "body is not JSON (EP)", body: "order_id=abc" },
  ])("$name → 422 problem+json and nothing started", async ({ body }) => {
    const { response, createPaymentSession } = await postPayment({ body });

    await expectProblem(response, 422, { type: "https://limitedwatches.dk/problems/validation_error" });
    expect(createPaymentSession).not.toHaveBeenCalled();
  });
});
