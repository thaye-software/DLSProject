import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import type { PaymentDetailsResult } from "../../src/application/get-payment-details.js";
import { contractSchema, openApi } from "../support/contract.js";
import { INTERNAL_JWT_SECRET, serve } from "../support/serve.js";
import { USER_ID } from "../fixtures/orders.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const PATH = `/internal/orders/${ORDER_ID}/payment-details`;

const payable: PaymentDetailsResult = {
  outcome: "payable",
  details: {
    orderId: ORDER_ID,
    userId: USER_ID,
    status: "RESERVED",
    amountDueDkk: 11_530_000,
    expiresAt: new Date("2026-10-14T10:30:00Z"),
  },
};

type TokenOptions = { secret?: string; issuer?: string; audience?: string; lifetimeS?: number; issuedAgoS?: number; alg?: string };

// Signs a token the way Payment's HttpOrdersClient does; options break one property at a time.
function serviceToken({
  secret = INTERNAL_JWT_SECRET,
  issuer = "payment",
  audience = "orders",
  lifetimeS = 60,
  issuedAgoS = 0,
  alg = "HS256",
}: TokenOptions = {}): Promise<string> {
  const iat = Math.floor(Date.now() / 1000) - issuedAgoS;
  return new SignJWT()
    .setProtectedHeader({ alg })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(iat)
    .setExpirationTime(iat + lifetimeS)
    .sign(new TextEncoder().encode(secret));
}

async function request({
  result = payable,
  authorization,
  path = PATH,
}: { result?: PaymentDetailsResult; authorization?: string | null; path?: string } = {}) {
  const getPaymentDetails = vi.fn(async () => result);
  const baseUrl = await serve({ getPaymentDetails });
  const token = authorization === undefined ? `Bearer ${await serviceToken()}` : authorization;
  const response = await fetch(`${baseUrl}${path}`, { headers: token === null ? {} : { authorization: token } });
  return { response, json: await response.json(), getPaymentDetails };
}

function expectProblem(json: unknown, code: string) {
  const validate = contractSchema("Problem");
  expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
  expect((json as { type: string }).type).toBe(`https://limitedwatches.dk/problems/${code}`);
}

describe("GET /internal/orders/{order_id}/payment-details", () => {
  it("answers 200 with the contract's example PaymentDetails", async () => {
    const { response, json, getPaymentDetails } = await request();

    expect(response.status).toBe(200);
    const validate = contractSchema("PaymentDetails");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    const example =
      openApi.paths["/internal/orders/{order_id}/payment-details"].get.responses["200"].content["application/json"].example;
    expect(json).toEqual({ ...example, expires_at: new Date(example.expires_at).toISOString() });
    expect(getPaymentDetails).toHaveBeenCalledWith(ORDER_ID);
  });

  it("answers 404 for an unknown order", async () => {
    const { response, json } = await request({ result: { outcome: "not_found" } });

    expect(response.status).toBe(404);
    expectProblem(json, "not_found");
  });

  it("answers 404 for an id that is not a UUID, without a lookup", async () => {
    const { response, getPaymentDetails } = await request({ path: "/internal/orders/abc/payment-details" });

    expect(response.status).toBe(404);
    expect(getPaymentDetails).not.toHaveBeenCalled();
  });

  it("answers 409 order_not_payable", async () => {
    const { response, json } = await request({ result: { outcome: "not_payable" } });

    expect(response.status).toBe(409);
    expectProblem(json, "order_not_payable");
  });

  it("accepts a token issued a moment ago that lives exactly 60 s (boundary)", async () => {
    const { response } = await request({ authorization: `Bearer ${await serviceToken({ issuedAgoS: 10 })}` });

    expect(response.status).toBe(200);
  });

  it.each([
    { name: "no Authorization header", authorization: null },
    { name: "a non-Bearer scheme", authorization: "Basic cGF5bWVudDpzZWNyZXQ=" },
    { name: "a token that is not a JWT", authorization: "Bearer not-a-jwt" },
    { name: "another secret", token: { secret: "some-other-secret-that-is-32-chars!!" } },
    { name: "an issuer that may not call (catalog)", token: { issuer: "catalog" } },
    { name: "another audience (catalog)", token: { audience: "catalog" } },
    { name: "an expired token", token: { issuedAgoS: 120 } },
    { name: "a 61 s lifetime (boundary + 1)", token: { lifetimeS: 61 } },
    { name: "HS512 instead of HS256", token: { alg: "HS512" } },
  ])("answers 401 for $name and does not look the order up", async ({ authorization, token }) => {
    const header = token ? `Bearer ${await serviceToken(token)}` : authorization;

    const { response, json, getPaymentDetails } = await request({ authorization: header });

    expect(response.status).toBe(401);
    expectProblem(json, "unauthorized");
    expect(getPaymentDetails).not.toHaveBeenCalled();
  });

  it("does not accept a gateway user instead of a service token", async () => {
    const baseUrl = await serve({ getPaymentDetails: async () => payable });

    const response = await fetch(`${baseUrl}${PATH}`, { headers: { "x-user-id": USER_ID, "x-user-role": "admin" } });

    expect(response.status).toBe(401);
  });
});
