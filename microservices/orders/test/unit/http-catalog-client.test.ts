import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { jwtVerify } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { HttpCatalogClient } from "../../src/adapters/catalog/http-catalog-client.js";
import { contractSchema, openApi } from "../support/contract.js";
import { PRODUCT_ID, submarinerLine } from "../fixtures/orders.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const JWT_SECRET = "orders-and-catalog-share-this-32-char-secret";
const EXPIRES_AT = new Date("2026-10-14T10:30:00Z");

const reservationExample = openApi.paths["/internal/reservations"].post.responses["201"].content["application/json"].example;

type Recorded = { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: string };

let server: Server | undefined;
let requests: Recorded[] = [];

afterEach(async () => {
  requests = [];
  const running = server;
  server = undefined;
  if (running) await new Promise((resolve) => running.close(resolve));
});

async function catalogStub(status: number, body?: unknown): Promise<HttpCatalogClient> {
  server = createServer((request, response) => {
    let received = "";
    request.on("data", (chunk) => (received += chunk));
    request.on("end", () => {
      requests.push({ method: request.method!, url: request.url!, headers: request.headers, body: received });
      response.writeHead(status, { "content-type": "application/json" });
      response.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }).listen(0);
  await new Promise((resolve) => server!.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return new HttpCatalogClient({ baseUrl, jwtSecret: JWT_SECRET });
}

function reserve(client: HttpCatalogClient) {
  return client.reserve({ orderId: ORDER_ID, items: [{ productId: PRODUCT_ID, quantity: 1 }], expiresAt: EXPIRES_AT });
}

describe("HttpCatalogClient.reserve", () => {
  it("returns Catalog's lines from the contract's example reservation", async () => {
    const client = await catalogStub(201, reservationExample);

    await expect(reserve(client)).resolves.toEqual({ kind: "reserved", lines: [submarinerLine] });
  });

  it("posts a contract-valid ReservationRequest with Idempotency-Key = order id", async () => {
    const client = await catalogStub(201, reservationExample);

    await reserve(client);

    const [request] = requests;
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("/internal/reservations");
    expect(request?.headers["idempotency-key"]).toBe(ORDER_ID);
    const validate = contractSchema("ReservationRequest");
    const body = JSON.parse(request!.body);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body).toEqual({ order_id: ORDER_ID, items: [{ product_id: PRODUCT_ID, quantity: 1 }], expires_at: "2026-10-14T10:30:00.000Z" });
  });

  it("signs a 60 s service JWT from orders to catalog", async () => {
    const client = await catalogStub(201, reservationExample);

    await reserve(client);

    const token = String(requests[0]?.headers.authorization).replace(/^Bearer /, "");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET), { issuer: "orders", audience: "catalog" });
    expect(payload.exp! - payload.iat!).toBe(60);
  });

  it("reports Catalog's unavailable products on 409", async () => {
    const problem = openApi.paths["/internal/reservations"].post.responses["409"].content["application/problem+json"].example;
    const client = await catalogStub(409, problem);

    await expect(reserve(client)).resolves.toEqual({ kind: "unavailable", productIds: [PRODUCT_ID] });
  });

  it("reports every requested product on a 409 without a product list", async () => {
    const client = await catalogStub(409, { title: "Out of stock" });

    await expect(reserve(client)).resolves.toEqual({ kind: "unavailable", productIds: [PRODUCT_ID] });
  });

  it.each([
    { name: "a 500", status: 500, body: { title: "boom" } },
    { name: "a reservation for another order", status: 201, body: { ...reservationExample, order_id: PRODUCT_ID } },
    { name: "a price in EUR", status: 201, body: { ...reservationExample, items: [{ ...reservationExample.items[0], unit_price: { amount_minor: 1, currency: "EUR" } }] } },
    { name: "no items", status: 201, body: { ...reservationExample, items: [] } },
  ])("throws on $name", async ({ status, body }) => {
    const client = await catalogStub(status, body);

    await expect(reserve(client)).rejects.toThrow(/Catalog/);
  });
});

describe("HttpCatalogClient.release", () => {
  it("deletes the order's reservation", async () => {
    const client = await catalogStub(204);

    await client.release(ORDER_ID);

    expect(requests[0]?.method).toBe("DELETE");
    expect(requests[0]?.url).toBe(`/internal/reservations/${ORDER_ID}`);
  });

  it("throws when Catalog does not confirm the release", async () => {
    const client = await catalogStub(500);

    await expect(client.release(ORDER_ID)).rejects.toThrow(/500/);
  });
});
