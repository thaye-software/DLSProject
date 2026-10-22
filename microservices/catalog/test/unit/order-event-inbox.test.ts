import { describe, expect, it, vi } from "vitest";
import { createInMemoryOrderEventInbox } from "../../src/adapters/memory/in-memory-order-event-inbox.js";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation } from "../../src/domain/reservation.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";

function watch(): Product {
  return {
    productId: PRODUCT_ID,
    name: "Rolex Submariner Date 126610LN",
    slug: "rolex-submariner-date-126610ln",
    brandName: "Rolex",
    model: "Submariner Date",
    price: { amountMinor: 11_500_000, currency: "DKK" },
    availability: "reserved",
    thumbnailUrl: null,
    stock: 1,
    version: 2,
  };
}

function reservation(): Reservation {
  return {
    reservationId: "11111111-1111-4111-8111-111111111111",
    orderId: ORDER_ID,
    status: "active",
    items: [
      {
        productId: PRODUCT_ID,
        productName: "Rolex Submariner Date 126610LN",
        quantity: 1,
        unitPrice: { amountMinor: 11_500_000, currency: "DKK" },
        thumbnailUrl: null,
      },
    ],
    expiresAt: new Date("2026-10-14T10:30:00.000Z"),
    createdAt: new Date("2026-10-14T10:00:00.000Z"),
  };
}

const event = { id: EVENT_ID, type: "order_confirmed", orderId: ORDER_ID };

describe("apply order event", () => {
  it("does not run the handler again for a CloudEvents id it already applied", async () => {
    const product = watch();
    const store = createInMemoryReservationStore([product], [reservation()]);
    const inbox = createInMemoryOrderEventInbox(store);
    const changeStock = vi.fn(async () => undefined);

    await expect(inbox.apply(event, changeStock)).resolves.toBe("applied");
    await expect(inbox.apply(event, changeStock)).resolves.toBe("duplicate");

    expect(changeStock).toHaveBeenCalledOnce();
    await expect(store.product(PRODUCT_ID)).resolves.toEqual(product);
  });

  it("changes nothing when the order id never reserved", async () => {
    const product = watch();
    const store = createInMemoryReservationStore([product]);
    const inbox = createInMemoryOrderEventInbox(store);
    const changeStock = vi.fn(async () => undefined);

    await expect(inbox.apply(event, changeStock)).resolves.toBe("unknown");

    expect(changeStock).not.toHaveBeenCalled();
    await expect(store.product(PRODUCT_ID)).resolves.toEqual(product);
    await expect(inbox.apply(event, changeStock)).resolves.toBe("unknown");
    expect(changeStock).not.toHaveBeenCalled();
  });
});
