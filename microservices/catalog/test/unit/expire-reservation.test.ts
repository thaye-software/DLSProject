import { describe, expect, it } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import { expireReservation } from "../../src/application/expire-reservation.js";
import { releaseDueReservations, SAFETY_NET_GRACE_MS } from "../../src/application/release-due-reservations.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation, ReservationStatus } from "../../src/domain/reservation.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const SUBMARINER_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const RESERVED_AT = new Date("2026-10-14T10:00:00.000Z");
const EXPIRED_AT = new Date("2026-10-14T10:30:00.000Z");
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
  throw new Error("this expiry must not allocate an id");
};

describe("expireReservation", () => {
  it("returns the stored quantity when the reservation is still active", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 1 })], [heldReservation()]);

    const expired = await expireReservation(ORDER_ID, EVENT_ID, {
      store,
      now: () => EXPIRED_AT,
      newId: ids(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });

    expect(expired).toMatchObject({ outcome: "released", reservation: { orderId: ORDER_ID, status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect(await store.events()).toEqual([
      expect.objectContaining({
        causationid: EVENT_ID,
        subject: SUBMARINER_ID,
        correlationid: ORDER_ID,
        data: expect.objectContaining({
          stock: 2,
          availability: "available",
          previous_availability: "reserved",
          reason: "order_released",
        }),
      }),
    ]);
  });

  it("adds nothing after the safety net has already released the reservation", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 1 })], [heldReservation()]);
    const dueAt = new Date(EXPIRES_AT.getTime() + SAFETY_NET_GRACE_MS);
    await releaseDueReservations({ store, now: () => dueAt, newId: ids(["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]) });

    const expired = await expireReservation(ORDER_ID, EVENT_ID, { store, now: () => dueAt, newId: refusingNewId });

    expect(expired).toMatchObject({ outcome: "already_released", reservation: { status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect(await store.events()).toHaveLength(1);
    expect((await store.events())[0]?.causationid).toBeNull();
  });
});
