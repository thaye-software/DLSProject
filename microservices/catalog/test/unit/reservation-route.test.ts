import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import type { ReleaseResult, ReserveRequest, ReserveResult } from "../../src/application/ports/reservation-store.js";
import { releaseReservation } from "../../src/application/release-reservation.js";
import { reserveStock } from "../../src/application/reserve-stock.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation } from "../../src/domain/reservation.js";
import { INTERNAL_JWT_SECRET, serve } from "../support/serve.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const OTHER_ORDER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const RESERVATION_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const RELEASE_EVENT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-10-14T10:00:00.000Z");
const EXPIRES_AT = "2026-10-14T10:30:00.000Z";

function watch(overrides: Partial<Product> = {}): Product {
  return {
    productId: PRODUCT_ID,
    name: "Rolex Submariner Date 126610LN",
    slug: "rolex-submariner-date-126610ln",
    brandName: "Rolex",
    model: "Submariner Date",
    price: { amountMinor: 11_500_000, currency: "DKK" },
    availability: "available",
    thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
    stock: 2,
    version: 1,
    ...overrides,
  };
}

function serviceToken({ issuer = "orders", audience = "catalog" }: { issuer?: string; audience?: string } = {}): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 60)
    .sign(new TextEncoder().encode(INTERNAL_JWT_SECRET));
}

function ids(values: string[]): () => string {
  let index = 0;
  return () => {
    const id = values[index];
    index += 1;
    if (id === undefined) throw new Error("newId was called more times than this test allows");
    return id;
  };
}

function catalog(products: Product[], reservations: Reservation[] = [], newId = ids([RESERVATION_ID, EVENT_ID, RELEASE_EVENT_ID])) {
  const store = createInMemoryReservationStore(products, reservations);
  const context = { store, now: () => NOW, newId };
  return {
    store,
    dependencies: {
      reserveStock: (request: ReserveRequest): Promise<ReserveResult> => reserveStock(request, context),
      releaseReservation: (orderId: string): Promise<ReleaseResult> => releaseReservation(orderId, context),
    },
  };
}

async function postReservation(
  baseUrl: string,
  body: unknown,
  { key = ORDER_ID, token = true }: { key?: string | null; token?: boolean | "wrong-issuer" } = {},
): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token === true) headers.authorization = `Bearer ${await serviceToken()}`;
  if (token === "wrong-issuer") headers.authorization = `Bearer ${await serviceToken({ issuer: "payment" })}`;
  if (key !== null) headers["idempotency-key"] = key;
  return fetch(`${baseUrl}/internal/reservations`, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}

const reservedBody = {
  order_id: ORDER_ID,
  items: [{ product_id: PRODUCT_ID, quantity: 1 }],
  expires_at: EXPIRES_AT,
};

describe("POST /internal/reservations", () => {
  it("answers 201 with the catalog price and does not decrement again on a repeat", async () => {
    const { store, dependencies } = catalog([watch()]);
    const baseUrl = await serve(dependencies);

    const created = await postReservation(baseUrl, reservedBody);
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({
      reservation_id: RESERVATION_ID,
      order_id: ORDER_ID,
      status: "active",
      items: [
        {
          product_id: PRODUCT_ID,
          product_name: "Rolex Submariner Date 126610LN",
          quantity: 1,
          unit_price: { amount_minor: 11_500_000, currency: "DKK" },
          thumbnail_url: "https://cdn.example.com/products/126610ln-1.jpg",
        },
      ],
      expires_at: new Date(EXPIRES_AT).toISOString(),
      created_at: NOW.toISOString(),
    });

    const repeated = await postReservation(baseUrl, { ...reservedBody, items: [{ product_id: PRODUCT_ID, quantity: 2 }] });
    expect(repeated.status).toBe(201);
    expect(await repeated.json()).toMatchObject({ reservation_id: RESERVATION_ID, items: [{ quantity: 1 }] });
    await expect(store.product(PRODUCT_ID)).resolves.toMatchObject({ stock: 1 });
  });

  it("answers 409 out_of_stock with the unavailable product ids", async () => {
    const { store, dependencies } = catalog([watch({ stock: 2 })]);
    const baseUrl = await serve(dependencies);
    const missingId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    const response = await postReservation(baseUrl, { ...reservedBody, items: [{ product_id: missingId, quantity: 1 }] });

    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toEqual({
      type: "https://limitedwatches.dk/problems/out_of_stock",
      title: "Out of stock",
      status: 409,
      detail: "Out of stock.",
      instance: "/internal/reservations",
      unavailable_product_ids: [missingId],
    });
    await expect(store.product(PRODUCT_ID)).resolves.toMatchObject({ stock: 2, version: 1 });
  });

  it.each([
    { name: "the Idempotency-Key is missing", key: null, body: reservedBody },
    { name: "the Idempotency-Key is not a UUID", key: "not-a-uuid", body: reservedBody },
    { name: "the Idempotency-Key is not order_id", key: OTHER_ORDER_ID, body: reservedBody },
    { name: "the body has no items", key: ORDER_ID, body: { ...reservedBody, items: [] } },
    { name: "the body has an unknown field", key: ORDER_ID, body: { ...reservedBody, note: "no" } },
  ])("answers 422 validation_error when $name", async ({ key, body }) => {
    const { store, dependencies } = catalog([watch()]);
    const baseUrl = await serve(dependencies);

    const response = await postReservation(baseUrl, body, { key });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      type: "https://limitedwatches.dk/problems/validation_error",
      title: "Invalid request",
      status: 422,
    });
    await expect(store.product(PRODUCT_ID)).resolves.toMatchObject({ stock: 2, version: 1 });
  });

  it("answers 422 when the body is not JSON", async () => {
    const { dependencies } = catalog([watch()]);
    const baseUrl = await serve(dependencies);

    const response = await postReservation(baseUrl, "{");

    expect(response.status).toBe(422);
    expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/validation_error");
  });

  it.each([
    { name: "the token is missing", token: false as const },
    { name: "the issuer is not orders", token: "wrong-issuer" as const },
  ])("answers 401 when $name", async ({ token }) => {
    const baseUrl = await serve(catalog([watch()]).dependencies);

    const response = await postReservation(baseUrl, reservedBody, { token });

    expect(response.status).toBe(401);
    expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/unauthorized");
  });
});

describe("DELETE /internal/reservations/{order_id}", () => {
  async function reservedCatalog() {
    const held = catalog([watch({ stock: 2 })]);
    const baseUrl = await serve(held.dependencies);
    const created = await postReservation(baseUrl, reservedBody);
    expect(created.status).toBe(201);
    return { ...held, baseUrl };
  }

  async function remove(baseUrl: string, orderId = ORDER_ID, token = true): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${await serviceToken()}`;
    return fetch(`${baseUrl}/internal/reservations/${orderId}`, { method: "DELETE", headers });
  }

  it("answers 204 and returns stock for an active reservation", async () => {
    const { store, baseUrl } = await reservedCatalog();

    const response = await remove(baseUrl);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    await expect(store.product(PRODUCT_ID)).resolves.toMatchObject({ stock: 2, availability: "available" });
  });

  it("answers 204 again without adding stock a second time", async () => {
    const { store, baseUrl } = await reservedCatalog();
    expect((await remove(baseUrl)).status).toBe(204);

    const response = await remove(baseUrl);

    expect(response.status).toBe(204);
    await expect(store.product(PRODUCT_ID)).resolves.toMatchObject({ stock: 2, version: 3 });
  });

  it("answers 204 without changing stock when the reservation is confirmed", async () => {
    const product = watch({ stock: 1, version: 2, availability: "available" });
    const reservation: Reservation = {
      reservationId: RESERVATION_ID,
      orderId: ORDER_ID,
      status: "confirmed",
      items: [{ productId: PRODUCT_ID, productName: product.name, quantity: 1, unitPrice: product.price, thumbnailUrl: product.thumbnailUrl }],
      expiresAt: new Date(EXPIRES_AT),
      createdAt: NOW,
    };
    const { store, dependencies } = catalog([product], [reservation], () => {
      throw new Error("releasing a confirmed reservation must not allocate an id");
    });
    const baseUrl = await serve(dependencies);

    const response = await remove(baseUrl);

    expect(response.status).toBe(204);
    await expect(store.product(PRODUCT_ID)).resolves.toEqual(product);
  });

  it("answers 204 when the order id is unknown", async () => {
    const product = watch();
    const { store, dependencies } = catalog([product]);
    const baseUrl = await serve(dependencies);

    const response = await remove(baseUrl, OTHER_ORDER_ID);

    expect(response.status).toBe(204);
    await expect(store.product(PRODUCT_ID)).resolves.toEqual(product);
  });

  it("answers 401 without a service token", async () => {
    const { baseUrl } = await reservedCatalog();

    const response = await remove(baseUrl, ORDER_ID, false);

    expect(response.status).toBe(401);
  });
});
