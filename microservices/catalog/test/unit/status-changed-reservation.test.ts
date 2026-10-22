import { describe, expect, it } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import { returnOnStatusChange, type OrderStatus } from "../../src/application/status-changed-reservation.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation, ReservationStatus } from "../../src/domain/reservation.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const OTHER_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBMARINER_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const RESERVED_AT = new Date("2026-10-14T10:00:00.000Z");
const CHANGED_AT = new Date("2026-10-14T12:00:00.000Z");
const EXPIRES_AT = new Date("2026-10-14T10:30:00.000Z");
const OUTBOX_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const RETURNING: readonly (readonly [OrderStatus, OrderStatus])[] = [
  ["PENDING", "RETURNED"],
  ["PENDING", "REFUNDED"],
  ["PROCESSING", "RETURNED"],
  ["PROCESSING", "REFUNDED"],
  ["SHIPPED", "RETURNED"],
  ["SHIPPED", "REFUNDED"],
  ["DELIVERED", "RETURNED"],
  ["DELIVERED", "REFUNDED"],
];

function watch(overrides: Partial<Product> = {}): Product {
  return {
    productId: SUBMARINER_ID,
    name: "Rolex Submariner Date 126610LN",
    slug: "rolex-submariner-date-126610ln",
    brandName: "Rolex",
    model: "Submariner Date",
    price: { amountMinor: 11_500_000, currency: "DKK" },
    availability: "sold",
    thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
    stock: 0,
    version: 3,
    ...overrides,
  };
}

function heldReservation(status: ReservationStatus = "confirmed"): Reservation {
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
  throw new Error("this status change must not allocate an id");
};

describe("returnOnStatusChange", () => {
  it.each(RETURNING)("returns the stored quantity when %s becomes %s", async (previousStatus, status) => {
    const store = createInMemoryReservationStore([watch()], [heldReservation()]);

    const returned = await returnOnStatusChange(ORDER_ID, EVENT_ID, previousStatus, status, {
      store,
      now: () => CHANGED_AT,
      newId: ids([OUTBOX_ID]),
    });

    expect(returned).toMatchObject({ outcome: "released", reservation: { orderId: ORDER_ID, status: "released" } });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 4, availability: "available" });
    expect(await store.events()).toEqual([
      expect.objectContaining({
        id: OUTBOX_ID,
        subject: SUBMARINER_ID,
        correlationid: ORDER_ID,
        causationid: EVENT_ID,
        data: expect.objectContaining({
          version: 4,
          availability: "available",
          previous_availability: "sold",
          stock: 1,
          reason: "order_released",
          order_id: ORDER_ID,
        }),
      }),
    ]);
  });

  it("acks a forward step without returning stock", async () => {
    const product = watch();
    const store = createInMemoryReservationStore([product], [heldReservation()]);

    const result = await returnOnStatusChange(ORDER_ID, EVENT_ID, "PENDING", "PROCESSING", {
      store,
      now: () => CHANGED_AT,
      newId: refusingNewId,
    });

    expect(result).toEqual({ outcome: "not_returning" });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect((await store.reservations())[0]?.status).toBe("confirmed");
    expect(await store.events()).toEqual([]);
  });

  it("does not add stock when REFUNDED follows RETURNED", async () => {
    const store = createInMemoryReservationStore([watch()], [heldReservation()]);
    await returnOnStatusChange(ORDER_ID, EVENT_ID, "DELIVERED", "RETURNED", {
      store,
      now: () => CHANGED_AT,
      newId: ids([OUTBOX_ID]),
    });

    const refunded = await returnOnStatusChange(ORDER_ID, OTHER_EVENT_ID, "RETURNED", "REFUNDED", {
      store,
      now: () => CHANGED_AT,
      newId: refusingNewId,
    });

    expect(refunded).toEqual({ outcome: "not_returning" });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 4, availability: "available" });
    expect(await store.events()).toHaveLength(1);
    expect((await store.reservations())[0]?.status).toBe("released");
  });

  it("does not add stock when the same order event is delivered again", async () => {
    const store = createInMemoryReservationStore([watch()], [heldReservation()]);
    await returnOnStatusChange(ORDER_ID, EVENT_ID, "DELIVERED", "RETURNED", {
      store,
      now: () => CHANGED_AT,
      newId: ids([OUTBOX_ID]),
    });

    const again = await returnOnStatusChange(ORDER_ID, EVENT_ID, "DELIVERED", "RETURNED", {
      store,
      now: () => CHANGED_AT,
      newId: refusingNewId,
    });

    expect(again).toEqual({ outcome: "duplicate" });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 4, availability: "available" });
    expect(await store.events()).toHaveLength(1);
  });

  it("acks a return for an order that never reserved", async () => {
    const product = watch();
    const store = createInMemoryReservationStore([product]);

    const result = await returnOnStatusChange(ORDER_ID, EVENT_ID, "DELIVERED", "RETURNED", {
      store,
      now: () => CHANGED_AT,
      newId: refusingNewId,
    });

    expect(result).toEqual({ outcome: "unknown" });
    await expect(store.product(SUBMARINER_ID)).resolves.toEqual(product);
    expect(await store.events()).toEqual([]);
  });
});
