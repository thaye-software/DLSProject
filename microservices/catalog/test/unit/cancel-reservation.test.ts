import { describe, expect, it } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import { cancelReservation } from "../../src/application/cancel-reservation.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation, ReservationStatus } from "../../src/domain/reservation.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const OTHER_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBMARINER_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const RESERVED_AT = new Date("2026-10-14T10:00:00.000Z");
const CANCELLED_AT = new Date("2026-10-14T10:10:00.000Z");
const EXPIRES_AT = new Date("2026-10-14T10:30:00.000Z");

function watch(overrides: Partial<Product> = {}): Product {
  return {
    productId: SUBMARINER_ID,
    name: "Rolex Submariner Date 126610LN",
    slug: "rolex-submariner-date-126610ln",
    brandName: "Rolex",
    model: "Submariner Date",
    price: { amountMinor: 11_500_000, currency: "DKK" },
    availability: "reserved",
    thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
    stock: 1,
    version: 2,
    ...overrides,
  };
}

function heldReservation(status: ReservationStatus = "active"): Reservation {
  const product = watch();
  return {
    reservationId: "11111111-1111-4111-8111-111111111111",
    orderId: ORDER_ID,
    status,
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
  throw new Error("this cancel must not allocate an id");
};

describe("cancelReservation", () => {
  it("returns the stored quantity for an active reservation and publishes order_released", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 1 })], [heldReservation()]);

    const cancelled = await cancelReservation(ORDER_ID, EVENT_ID, {
      store,
      now: () => CANCELLED_AT,
      newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });

    expect(cancelled).toMatchObject({ outcome: "released", reservation: { orderId: ORDER_ID, status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect(await store.events()).toEqual([
      expect.objectContaining({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "product_availability_changed",
        subject: SUBMARINER_ID,
        correlationid: ORDER_ID,
        causationid: EVENT_ID,
        data: expect.objectContaining({
          version: 3,
          availability: "available",
          previous_availability: "reserved",
          stock: 2,
          reason: "order_released",
          order_id: ORDER_ID,
        }),
      }),
    ]);
  });

  it("returns the stored quantity when the reservation was already confirmed", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 0, availability: "sold", version: 3 })], [heldReservation("confirmed")]);

    const cancelled = await cancelReservation(ORDER_ID, EVENT_ID, {
      store,
      now: () => CANCELLED_AT,
      newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });

    expect(cancelled).toMatchObject({ outcome: "released", reservation: { status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 4, availability: "available" });
    expect((await store.events())[0]?.data).toMatchObject({
      availability: "available",
      previous_availability: "sold",
      stock: 1,
      reason: "order_released",
    });
    expect((await store.events())[0]?.causationid).toBe(EVENT_ID);
  });

  it("does not add stock when the same order event is delivered again", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 1 })], [heldReservation()]);
    await cancelReservation(ORDER_ID, EVENT_ID, {
      store,
      now: () => CANCELLED_AT,
      newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });

    const again = await cancelReservation(ORDER_ID, EVENT_ID, { store, now: () => CANCELLED_AT, newId: refusingNewId });

    expect(again).toEqual({ outcome: "duplicate" });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect(await store.events()).toHaveLength(1);
  });

  it("does not add stock when the reservation was already released", async () => {
    const product = watch({ stock: 2, availability: "available", version: 3 });
    const store = createInMemoryReservationStore([product], [heldReservation("released")]);

    const result = await cancelReservation(ORDER_ID, OTHER_EVENT_ID, { store, now: () => CANCELLED_AT, newId: refusingNewId });

    expect(result).toMatchObject({ outcome: "already_released", reservation: { status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect(await store.events()).toEqual([]);
  });
});
