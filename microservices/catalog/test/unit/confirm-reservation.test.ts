import { describe, expect, it } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import { confirmReservation } from "../../src/application/confirm-reservation.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation, ReservationStatus } from "../../src/domain/reservation.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const OTHER_ORDER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const OTHER_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBMARINER_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const RESERVED_AT = new Date("2026-10-14T10:00:00.000Z");
const CONFIRMED_AT = new Date("2026-10-14T10:04:10.000Z");
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

function heldReservation(status: ReservationStatus = "active", orderId = ORDER_ID): Reservation {
  const product = watch();
  return {
    reservationId: orderId === ORDER_ID ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
    orderId,
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
  throw new Error("this confirm must not allocate an id");
};

describe("confirmReservation", () => {
  it("confirms an active reservation without decrementing stock, and leaves a remaining unit available", async () => {
    const product = watch({ stock: 1 });
    const store = createInMemoryReservationStore([product], [heldReservation()]);

    const confirmed = await confirmReservation(ORDER_ID, EVENT_ID, {
      store,
      now: () => CONFIRMED_AT,
      newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });

    expect(confirmed).toMatchObject({ outcome: "confirmed", reservation: { orderId: ORDER_ID, status: "confirmed" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 3, availability: "available" });
    expect(await store.events()).toEqual([
      expect.objectContaining({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        source: "/services/catalog",
        type: "product_availability_changed",
        time: CONFIRMED_AT.toISOString(),
        subject: SUBMARINER_ID,
        correlationid: ORDER_ID,
        causationid: EVENT_ID,
        data: expect.objectContaining({
          version: 3,
          availability: "available",
          previous_availability: "reserved",
          stock: 1,
          reason: "order_confirmed",
          order_id: ORDER_ID,
          changed_at: CONFIRMED_AT.toISOString(),
        }),
      }),
    ]);
  });

  it("marks the product sold when confirming leaves sellable stock at 0", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 0 })], [heldReservation()]);

    await confirmReservation(ORDER_ID, EVENT_ID, {
      store,
      now: () => CONFIRMED_AT,
      newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });

    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 0, version: 3, availability: "sold" });
    expect((await store.events())[0]?.data).toMatchObject({
      availability: "sold",
      previous_availability: "reserved",
      stock: 0,
      reason: "order_confirmed",
    });
  });

  it("stays reserved when another active reservation still holds the product", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 0 })], [heldReservation(), heldReservation("active", OTHER_ORDER_ID)]);

    await confirmReservation(ORDER_ID, EVENT_ID, {
      store,
      now: () => CONFIRMED_AT,
      newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });

    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 0, version: 3, availability: "reserved" });
    expect((await store.events())[0]?.data).toMatchObject({ availability: "reserved", stock: 0, reason: "order_confirmed" });
    expect((await store.reservations()).find((reservation) => reservation.orderId === OTHER_ORDER_ID)?.status).toBe("active");
  });

  it("does not decrement stock or write another event when the same order event is delivered again", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 1 })], [heldReservation()]);
    const first = { store, now: () => CONFIRMED_AT, newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]) };
    await confirmReservation(ORDER_ID, EVENT_ID, first);

    const again = await confirmReservation(ORDER_ID, EVENT_ID, { store, now: () => CONFIRMED_AT, newId: refusingNewId });

    expect(again).toEqual({ outcome: "duplicate" });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 3, availability: "available" });
    expect(await store.events()).toHaveLength(1);
  });

  it("changes nothing when the reservation was already released", async () => {
    const product = watch({ stock: 1, availability: "available", version: 3 });
    const store = createInMemoryReservationStore([product], [heldReservation("released")]);

    const result = await confirmReservation(ORDER_ID, EVENT_ID, { store, now: () => CONFIRMED_AT, newId: refusingNewId });

    expect(result).toMatchObject({ outcome: "already_released", reservation: { status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect(await store.events()).toEqual([]);
  });

  it("changes nothing when the reservation was already confirmed", async () => {
    const product = watch({ stock: 0, availability: "sold", version: 3 });
    const store = createInMemoryReservationStore([product], [heldReservation("confirmed")]);

    const result = await confirmReservation(ORDER_ID, OTHER_EVENT_ID, { store, now: () => CONFIRMED_AT, newId: refusingNewId });

    expect(result).toMatchObject({ outcome: "already_confirmed", reservation: { status: "confirmed" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect(await store.events()).toEqual([]);
  });

  it("changes nothing when the order id never reserved", async () => {
    const product = watch();
    const store = createInMemoryReservationStore([product]);

    const result = await confirmReservation(ORDER_ID, EVENT_ID, { store, now: () => CONFIRMED_AT, newId: refusingNewId });

    expect(result).toEqual({ outcome: "unknown" });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect(await store.events()).toEqual([]);
  });

  it("throws when the reserved product is not in the snapshot", async () => {
    const store = createInMemoryReservationStore([], [heldReservation()]);

    await expect(confirmReservation(ORDER_ID, EVENT_ID, { store, now: () => CONFIRMED_AT, newId: refusingNewId })).rejects.toThrow(
      `Product ${SUBMARINER_ID} disappeared before its reservation could be confirmed`,
    );
  });
});
