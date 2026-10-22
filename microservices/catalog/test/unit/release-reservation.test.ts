import { describe, expect, it } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import { releaseReservation } from "../../src/application/release-reservation.js";
import { reserveStock } from "../../src/application/reserve-stock.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation } from "../../src/domain/reservation.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const OTHER_ORDER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const SUBMARINER_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const DATEJUST_ID = "1c0d9a3e-6b21-4f0a-9c55-7e2b8d4a1f30";
const RESERVED_AT = new Date("2026-10-14T10:00:00.000Z");
const RELEASED_AT = new Date("2026-10-14T10:05:00.000Z");
const EXPIRES_AT = new Date("2026-10-14T10:30:00.000Z");

function watch(overrides: Partial<Product> = {}): Product {
  return {
    productId: SUBMARINER_ID,
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

function ids(values: string[]): () => string {
  let index = 0;
  return () => {
    const id = values[index];
    index += 1;
    if (id === undefined) throw new Error("newId was called more times than this test allows");
    return id;
  };
}

const refusingNewId = (): string => {
  throw new Error("this release must not allocate an id");
};

describe("releaseReservation", () => {
  it("returns the reserved quantities once and publishes order_released", async () => {
    const store = createInMemoryReservationStore([
      watch({ stock: 2 }),
      watch({ productId: DATEJUST_ID, name: "Datejust", slug: "datejust", model: "Datejust", stock: 1 }),
    ]);
    await reserveStock(
      {
        orderId: ORDER_ID,
        items: [
          { productId: SUBMARINER_ID, quantity: 1 },
          { productId: DATEJUST_ID, quantity: 1 },
        ],
        expiresAt: EXPIRES_AT,
      },
      { store, now: () => RESERVED_AT, newId: ids(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"]) },
    );

    const released = await releaseReservation(ORDER_ID, {
      store,
      now: () => RELEASED_AT,
      newId: ids(["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"]),
    });

    expect(released).toMatchObject({
      outcome: "released",
      reservation: { orderId: ORDER_ID, status: "released", expiresAt: EXPIRES_AT, createdAt: RESERVED_AT },
    });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    await expect(store.product(DATEJUST_ID)).resolves.toMatchObject({ stock: 1, version: 3, availability: "available" });
    const events = await store.events();
    expect(events.slice(2)).toEqual([
      expect.objectContaining({
        id: "44444444-4444-4444-8444-444444444444",
        source: "/services/catalog",
        type: "product_availability_changed",
        time: RELEASED_AT.toISOString(),
        subject: SUBMARINER_ID,
        correlationid: ORDER_ID,
        causationid: null,
        data: expect.objectContaining({
          version: 3,
          availability: "available",
          previous_availability: "reserved",
          stock: 2,
          reason: "order_released",
          order_id: ORDER_ID,
          changed_at: RELEASED_AT.toISOString(),
        }),
      }),
      expect.objectContaining({
        id: "55555555-5555-4555-8555-555555555555",
        subject: DATEJUST_ID,
        causationid: null,
        data: expect.objectContaining({ version: 3, availability: "available", stock: 1, reason: "order_released" }),
      }),
    ]);
  });

  it("does not add stock when the same reservation is released again", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 2 })]);
    await reserveStock(
      { orderId: ORDER_ID, items: [{ productId: SUBMARINER_ID, quantity: 1 }], expiresAt: EXPIRES_AT },
      { store, now: () => RESERVED_AT, newId: ids(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]) },
    );
    await releaseReservation(ORDER_ID, { store, now: () => RELEASED_AT, newId: ids(["44444444-4444-4444-8444-444444444444"]) });

    const again = await releaseReservation(ORDER_ID, { store, now: () => RELEASED_AT, newId: refusingNewId });

    expect(again).toMatchObject({ outcome: "already_released", reservation: { status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect(await store.events()).toHaveLength(2);
  });

  it("does not change stock when the reservation is confirmed", async () => {
    const product = watch({ stock: 1, version: 2, availability: "available" });
    const reservation: Reservation = {
      reservationId: "11111111-1111-4111-8111-111111111111",
      orderId: ORDER_ID,
      status: "confirmed",
      items: [
        {
          productId: SUBMARINER_ID,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          thumbnailUrl: product.thumbnailUrl,
        },
      ],
      expiresAt: EXPIRES_AT,
      createdAt: RESERVED_AT,
    };
    const store = createInMemoryReservationStore([product], [reservation]);

    const result = await releaseReservation(ORDER_ID, { store, now: () => RELEASED_AT, newId: refusingNewId });

    expect(result).toEqual({ outcome: "confirmed", reservation });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect(await store.events()).toEqual([]);
  });

  it("does not change stock when the order id is unknown", async () => {
    const product = watch();
    const store = createInMemoryReservationStore([product]);

    const result = await releaseReservation(ORDER_ID, { store, now: () => RELEASED_AT, newId: refusingNewId });

    expect(result).toEqual({ outcome: "unknown" });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect(await store.events()).toEqual([]);
  });

  it("stays reserved when another active reservation still holds the product", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 2 })]);
    const reserveIds = ids([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ]);
    await reserveStock({ orderId: ORDER_ID, items: [{ productId: SUBMARINER_ID, quantity: 1 }], expiresAt: EXPIRES_AT }, { store, now: () => RESERVED_AT, newId: reserveIds });
    await reserveStock({ orderId: OTHER_ORDER_ID, items: [{ productId: SUBMARINER_ID, quantity: 1 }], expiresAt: EXPIRES_AT }, { store, now: () => RESERVED_AT, newId: reserveIds });

    await releaseReservation(ORDER_ID, { store, now: () => RELEASED_AT, newId: ids(["55555555-5555-4555-8555-555555555555"]) });

    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 4, availability: "reserved" });
    expect((await store.events()).at(-1)?.data).toMatchObject({
      availability: "reserved",
      previous_availability: "reserved",
      stock: 1,
      reason: "order_released",
    });
  });

  it("throws when the reserved product is not in the snapshot", async () => {
    const reservation: Reservation = {
      reservationId: "11111111-1111-4111-8111-111111111111",
      orderId: ORDER_ID,
      status: "active",
      items: [
        {
          productId: SUBMARINER_ID,
          productName: "Rolex Submariner Date 126610LN",
          quantity: 1,
          unitPrice: { amountMinor: 11_500_000, currency: "DKK" },
          thumbnailUrl: null,
        },
      ],
      expiresAt: EXPIRES_AT,
      createdAt: RESERVED_AT,
    };
    const store = createInMemoryReservationStore([], [reservation]);

    await expect(releaseReservation(ORDER_ID, { store, now: () => RELEASED_AT, newId: refusingNewId })).rejects.toThrow(
      `Product ${SUBMARINER_ID} disappeared before its reservation could be released`,
    );
  });
});
