import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { jwtVerify } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { HttpOrdersClient } from "../../src/adapters/orders/http-orders-client.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const JWT_SECRET = "orders-and-payment-share-this-32-char-secret";

const paymentDetails = {
  order_id: ORDER_ID,
  user_id: "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11",
  status: "RESERVED",
  amount_due: { amount_minor: 11530000, currency: "DKK" },
  expires_at: "2026-10-14T10:30:00Z",
};

let server: Server | undefined;
let requests: IncomingMessage[] = [];

afterEach(async () => {
  requests = [];
  const running = server;
  server = undefined;
  if (running) await new Promise((resolve) => running.close(resolve));
});

async function ordersStub(status: number, body: unknown): Promise<string> {
  server = createServer((request, response) => {
    requests.push(request);
    response.writeHead(status, { "content-type": status === 200 ? "application/json" : "application/problem+json" });
    response.end(JSON.stringify(body));
  }).listen(0);
  await new Promise((resolve) => server!.once("listening", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function clientFor(baseUrl: string) {
  return new HttpOrdersClient({ baseUrl, jwtSecret: JWT_SECRET });
}

describe("HttpOrdersClient.getPaymentDetails", () => {
  it("returns the payment details Orders sends", async () => {
    const client = clientFor(await ordersStub(200, paymentDetails));

    await expect(client.getPaymentDetails(ORDER_ID)).resolves.toEqual({ kind: "found", details: paymentDetails });
  });

  it("calls Orders' internal payment-details endpoint", async () => {
    const client = clientFor(await ordersStub(200, paymentDetails));

    await client.getPaymentDetails(ORDER_ID);

    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe("GET");
    expect(requests[0]!.url).toBe(`/internal/orders/${ORDER_ID}/payment-details`);
  });

  it("builds the same path when ORDERS_URL ends with a slash", async () => {
    const client = clientFor(`${await ordersStub(200, paymentDetails)}/`);

    await client.getPaymentDetails(ORDER_ID);

    expect(requests[0]!.url).toBe(`/internal/orders/${ORDER_ID}/payment-details`);
  });

  it("sends a service JWT from payment to orders that expires within 60 seconds", async () => {
    const client = clientFor(await ordersStub(200, paymentDetails));

    await client.getPaymentDetails(ORDER_ID);

    const authorization = requests[0]!.headers.authorization ?? "";
    expect(authorization).toMatch(/^Bearer /);
    const { payload, protectedHeader } = await jwtVerify(
      authorization.slice("Bearer ".length),
      new TextEncoder().encode(JWT_SECRET),
      { issuer: "payment", audience: "orders", algorithms: ["HS256"] },
    );
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.exp! - payload.iat!).toBeGreaterThan(0);
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(60);
  });

  it.each([
    { name: "404 → not found (EP)", status: 404, result: { kind: "not_found" } },
    { name: "409 → not payable (EP)", status: 409, result: { kind: "not_payable" } },
  ])("$name", async ({ status, result }) => {
    const client = clientFor(await ordersStub(status, { type: "https://limitedwatches.dk/problems/x", status }));

    await expect(client.getPaymentDetails(ORDER_ID)).resolves.toEqual(result);
  });

  it.each([
    { name: "401, Orders rejected the service JWT (EP)", status: 401, body: { status: 401 } },
    { name: "500 (EP)", status: 500, body: { status: 500 } },
    { name: "200 without amount_due (EP)", status: 200, body: { ...paymentDetails, amount_due: undefined } },
    { name: "200 with a float amount (EP)", status: 200, body: { ...paymentDetails, amount_due: { amount_minor: 115300.5, currency: "DKK" } } },
  ])("throws on $name", async ({ status, body }) => {
    const client = clientFor(await ordersStub(status, body));

    await expect(client.getPaymentDetails(ORDER_ID)).rejects.toThrow(/Orders/);
  });

  it("throws when Orders is not reachable", async () => {
    const baseUrl = await ordersStub(200, paymentDetails);
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;

    await expect(clientFor(baseUrl).getPaymentDetails(ORDER_ID)).rejects.toThrow();
  });
});
