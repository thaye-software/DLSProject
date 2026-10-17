import { describe, expect, it, vi } from "vitest";
import { expireDueOrders, orderExpiredEvent } from "../../src/application/expire-orders.js";
import type { ExpiryStore } from "../../src/application/ports/expiry-store.js";
import { reservedOrder, submarinerLine } from "../fixtures/orders.js";
import { eventSchema } from "../support/contract.js";

const NOW = new Date("2026-10-14T10:30:04Z");

describe("orderExpiredEvent", () => {
  it("builds a contract-valid order_expired with the items to release", () => {
    const order = reservedOrder({ items: [submarinerLine, { ...submarinerLine, productId: "0c5e1f2a-3b4d-4e6f-8a9b-1c2d3e4f5a6b", quantity: 2 }] });

    const event = orderExpiredEvent(order, NOW, () => "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b");

    const validate = eventSchema("OrderExpiredEvent");
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
    expect(event).toMatchObject({
      type: "order_expired",
      subject: order.id,
      time: NOW.toISOString(),
      causationid: null,
      data: {
        items: [
          { product_id: submarinerLine.productId, quantity: 1 },
          { product_id: "0c5e1f2a-3b4d-4e6f-8a9b-1c2d3e4f5a6b", quantity: 2 },
        ],
        reserved_at: "2026-10-14T10:00:00.000Z",
        // When the reservation ran out, not when the sweeper ran.
        expired_at: "2026-10-14T10:30:00.000Z",
      },
    });
  });
});

describe("expireDueOrders", () => {
  function storeReturning(...batches: number[]) {
    const expireDue = vi.fn<ExpiryStore["expireDue"]>();
    for (const size of batches) expireDue.mockResolvedValueOnce(Array.from({ length: size }, (_, index) => `order-${index}`));
    return { expireDue };
  }

  it("keeps sweeping while batches come back full, and returns the total", async () => {
    const store = storeReturning(2, 2, 1);

    await expect(expireDueOrders({ store, now: () => NOW, newId: () => "id", batchSize: 2 })).resolves.toBe(5);
    expect(store.expireDue).toHaveBeenCalledTimes(3);
    expect(store.expireDue).toHaveBeenCalledWith(expect.objectContaining({ now: NOW, limit: 2 }));
  });

  it("stops after one empty batch", async () => {
    const store = storeReturning(0);

    await expect(expireDueOrders({ store, now: () => NOW, newId: () => "id" })).resolves.toBe(0);
    expect(store.expireDue).toHaveBeenCalledTimes(1);
  });

  it("asks once more after a batch that was exactly full (boundary)", async () => {
    const store = storeReturning(2, 0);

    await expect(expireDueOrders({ store, now: () => NOW, newId: () => "id", batchSize: 2 })).resolves.toBe(2);
    expect(store.expireDue).toHaveBeenCalledTimes(2);
  });
});
