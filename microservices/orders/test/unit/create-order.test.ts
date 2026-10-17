import { describe, expect, it, vi } from "vitest";
import { createOrder, orderIdFor, type CreateOrderDependencies } from "../../src/application/create-order.js";
import type { CatalogClient, ReservationResult } from "../../src/application/ports/catalog-client.js";
import type { OrderRepository } from "../../src/application/ports/order-repository.js";
import type { Order } from "../../src/domain/order.js";
import {
  createOrderRequest,
  IDEMPOTENCY_KEY,
  OTHER_PRODUCT_ID,
  PRODUCT_ID,
  reservedOrder,
  submarinerLine,
  USER_ID,
} from "../fixtures/orders.js";

const NOW = new Date("2026-10-14T10:00:00Z");
const SHIPPING = 30_000;

function catalogReturning(result: ReservationResult) {
  return {
    reserve: vi.fn<CatalogClient["reserve"]>(async () => result),
    release: vi.fn<CatalogClient["release"]>(async () => undefined),
  };
}

function inMemoryOrders(stored: Order | null = null) {
  return {
    findByIdempotencyKey: vi.fn<OrderRepository["findByIdempotencyKey"]>(async () => stored),
    insert: vi.fn<OrderRepository["insert"]>(async () => ({ kind: "inserted" as const })),
  };
}

function dependencies(catalog: ReturnType<typeof catalogReturning>, orders: ReturnType<typeof inMemoryOrders>) {
  return { catalog, orders, shippingPriceDkk: SHIPPING, now: () => NOW } satisfies CreateOrderDependencies;
}

describe("createOrder", () => {
  it("reserves the stock and stores a RESERVED order that expires in 30 minutes", async () => {
    const catalog = catalogReturning({ kind: "reserved", lines: [submarinerLine] });
    const orders = inMemoryOrders();

    const result = await createOrder(createOrderRequest, dependencies(catalog, orders));

    const id = orderIdFor(USER_ID, IDEMPOTENCY_KEY);
    const expiresAt = new Date("2026-10-14T10:30:00Z");
    expect(catalog.reserve).toHaveBeenCalledWith({ orderId: id, items: createOrderRequest.items, expiresAt });
    expect(result).toEqual({
      outcome: "created",
      order: reservedOrder({ id, createdAt: NOW, expiresAt }),
    });
    expect(orders.insert).toHaveBeenCalledWith(reservedOrder({ id, createdAt: NOW, expiresAt }), IDEMPOTENCY_KEY);
  });

  it("totals the lines with Catalog's prices, times the quantity, plus flat shipping", async () => {
    const strap = { ...submarinerLine, productId: OTHER_PRODUCT_ID, productName: "Strap", quantity: 2, unitPriceDkk: 50_000 };
    const catalog = catalogReturning({ kind: "reserved", lines: [strap, submarinerLine] });
    const request = {
      ...createOrderRequest,
      items: [
        { productId: PRODUCT_ID, quantity: 1 },
        { productId: OTHER_PRODUCT_ID, quantity: 2 },
      ],
    };

    const result = await createOrder(request, dependencies(catalog, inMemoryOrders()));

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") return;
    expect(result.order.items.map((line) => line.productId)).toEqual([PRODUCT_ID, OTHER_PRODUCT_ID]);
    expect(result.order.subTotalDkk).toBe(11_500_000 + 2 * 50_000);
    expect(result.order.totalPriceDkk).toBe(11_600_000 + SHIPPING);
  });

  it("derives the same order id for the same user and key, and a different one otherwise", () => {
    expect(orderIdFor(USER_ID, IDEMPOTENCY_KEY)).toBe(orderIdFor(USER_ID, IDEMPOTENCY_KEY));
    expect(orderIdFor(USER_ID, IDEMPOTENCY_KEY)).not.toBe(orderIdFor(USER_ID, OTHER_PRODUCT_ID));
    expect(orderIdFor(USER_ID, IDEMPOTENCY_KEY)).not.toBe(orderIdFor(OTHER_PRODUCT_ID, IDEMPOTENCY_KEY));
  });

  it("returns the stored order for a repeated Idempotency-Key without calling Catalog", async () => {
    const stored = reservedOrder({ status: "PENDING" });
    const catalog = catalogReturning({ kind: "reserved", lines: [submarinerLine] });

    const result = await createOrder(createOrderRequest, dependencies(catalog, inMemoryOrders(stored)));

    expect(result).toEqual({ outcome: "replayed", order: stored });
    expect(catalog.reserve).not.toHaveBeenCalled();
  });

  it("reports the unavailable products and stores nothing when Catalog is out of stock", async () => {
    const catalog = catalogReturning({ kind: "unavailable", productIds: [PRODUCT_ID] });
    const orders = inMemoryOrders();

    const result = await createOrder(createOrderRequest, dependencies(catalog, orders));

    expect(result).toEqual({ outcome: "unavailable", productIds: [PRODUCT_ID] });
    expect(orders.insert).not.toHaveBeenCalled();
  });

  it("returns the concurrent winner and keeps its reservation when the insert is a duplicate", async () => {
    const winner = reservedOrder();
    const catalog = catalogReturning({ kind: "reserved", lines: [submarinerLine] });
    const orders = inMemoryOrders();
    orders.findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    orders.insert.mockResolvedValue({ kind: "duplicate" });

    const result = await createOrder(createOrderRequest, dependencies(catalog, orders));

    expect(result).toEqual({ outcome: "replayed", order: winner });
    expect(catalog.release).not.toHaveBeenCalled();
  });

  it("releases the reservation and rethrows when storing the order fails", async () => {
    const catalog = catalogReturning({ kind: "reserved", lines: [submarinerLine] });
    const orders = inMemoryOrders();
    orders.insert.mockRejectedValue(new Error("database down"));

    await expect(createOrder(createOrderRequest, dependencies(catalog, orders))).rejects.toThrow("database down");
    expect(catalog.release).toHaveBeenCalledWith(orderIdFor(USER_ID, IDEMPOTENCY_KEY));
  });

  it("still rethrows the original error when releasing fails too", async () => {
    const catalog = catalogReturning({ kind: "reserved", lines: [submarinerLine] });
    catalog.release.mockRejectedValue(new Error("catalog down"));
    const orders = inMemoryOrders();
    orders.insert.mockRejectedValue(new Error("database down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(createOrder(createOrderRequest, dependencies(catalog, orders))).rejects.toThrow("database down");
  });

  it.each([
    { name: "a missing line", lines: [] },
    { name: "a different quantity", lines: [{ ...submarinerLine, quantity: 2 }] },
    { name: "a different product", lines: [{ ...submarinerLine, productId: OTHER_PRODUCT_ID }] },
  ])("releases the reservation and throws when Catalog's reservation has $name", async ({ lines }) => {
    const catalog = catalogReturning({ kind: "reserved", lines });
    const orders = inMemoryOrders();

    await expect(createOrder(createOrderRequest, dependencies(catalog, orders))).rejects.toThrow(/Catalog/);
    expect(orders.insert).not.toHaveBeenCalled();
    expect(catalog.release).toHaveBeenCalled();
  });
});
