import { describe, expect, it } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import { productAfterStockCheck, reserveStock } from "../../src/application/reserve-stock.js";
import type { Product } from "../../src/domain/product.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const SUBMARINER_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const DATEJUST_ID = "1c0d9a3e-6b21-4f0a-9c55-7e2b8d4a1f30";
const MISSING_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NOW = new Date("2026-10-14T10:00:00.000Z");
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

async function reserve(
  products: Product[],
  items: { productId: string; quantity: number }[],
  options: { orderId?: string; expiresAt?: Date; newId?: () => string } = {},
) {
  const store = createInMemoryReservationStore(products);
  const result = await reserveStock(
    { orderId: options.orderId ?? ORDER_ID, items, expiresAt: options.expiresAt ?? EXPIRES_AT },
    { store, now: () => NOW, newId: options.newId ?? ids(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]) },
  );
  return { store, result };
}

describe("reserveStock", () => {
  it("reserves every line, copies the catalog price, and writes one outbox event per product", async () => {
    const expiresAt = new Date(EXPIRES_AT);
    const { store, result } = await reserve(
      [watch(), watch({ productId: DATEJUST_ID, name: "Datejust", slug: "datejust", model: "Datejust", stock: 1, price: { amountMinor: 8_000_000, currency: "DKK" } })],
      [
        { productId: SUBMARINER_ID, quantity: 1 },
        { productId: DATEJUST_ID, quantity: 1 },
      ],
      { expiresAt, newId: ids(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"]) },
    );
    expiresAt.setTime(0);

    expect(result).toEqual({
      outcome: "reserved",
      reservation: {
        reservationId: "11111111-1111-4111-8111-111111111111",
        orderId: ORDER_ID,
        status: "active",
        items: [
          {
            productId: SUBMARINER_ID,
            productName: "Rolex Submariner Date 126610LN",
            quantity: 1,
            unitPrice: { amountMinor: 11_500_000, currency: "DKK" },
            thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
          },
          {
            productId: DATEJUST_ID,
            productName: "Datejust",
            quantity: 1,
            unitPrice: { amountMinor: 8_000_000, currency: "DKK" },
            thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
          },
        ],
        expiresAt: EXPIRES_AT,
        createdAt: NOW,
      },
    });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 2, availability: "reserved" });
    await expect(store.product(DATEJUST_ID)).resolves.toMatchObject({ stock: 0, version: 2, availability: "reserved" });
    expect(await store.events()).toEqual([
      expect.objectContaining({
        id: "22222222-2222-4222-8222-222222222222",
        source: "/services/catalog",
        type: "product_availability_changed",
        time: NOW.toISOString(),
        subject: SUBMARINER_ID,
        correlationid: ORDER_ID,
        causationid: null,
        data: expect.objectContaining({
          product_id: SUBMARINER_ID,
          version: 2,
          availability: "reserved",
          previous_availability: "available",
          stock: 1,
          reason: "order_reserved",
          order_id: ORDER_ID,
          changed_at: NOW.toISOString(),
        }),
      }),
      expect.objectContaining({
        id: "33333333-3333-4333-8333-333333333333",
        subject: DATEJUST_ID,
        causationid: null,
        data: expect.objectContaining({ version: 2, availability: "reserved", previous_availability: "available", stock: 0, reason: "order_reserved" }),
      }),
    ]);
  });

  it("keeps both lines when one product is requested twice and the sum fits", async () => {
    const { store, result } = await reserve([watch({ stock: 3 })], [
      { productId: SUBMARINER_ID, quantity: 1 },
      { productId: SUBMARINER_ID, quantity: 1 },
    ]);

    expect(result).toMatchObject({
      outcome: "reserved",
      reservation: { items: [{ quantity: 1 }, { quantity: 1 }] },
    });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 2, availability: "reserved" });
    expect(await store.events()).toHaveLength(1);
  });

  it("leaves a product reserved when another order holds some of the remaining stock", async () => {
    const { store } = await reserve([watch({ availability: "reserved", stock: 2, version: 4 })], [{ productId: SUBMARINER_ID, quantity: 1 }]);

    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 5, availability: "reserved" });
    expect((await store.events())[0]?.data.previous_availability).toBe("reserved");
  });

  it("changes nothing when a later line cannot be reserved", async () => {
    const { store, result } = await reserve([watch({ stock: 2 }), watch({ productId: DATEJUST_ID, availability: "hidden", stock: 4 })], [
      { productId: SUBMARINER_ID, quantity: 1 },
      { productId: DATEJUST_ID, quantity: 1 },
      { productId: MISSING_ID, quantity: 1 },
    ]);

    expect(result).toEqual({ outcome: "out_of_stock", unavailableProductIds: [DATEJUST_ID, MISSING_ID] });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 1, availability: "available" });
    await expect(store.product(DATEJUST_ID)).resolves.toMatchObject({ stock: 4, version: 1, availability: "hidden" });
    expect(await store.events()).toEqual([]);
  });

  it.each([
    { name: "missing", products: [watch()], items: [{ productId: MISSING_ID, quantity: 1 }], unavailable: [MISSING_ID] },
    { name: "hidden", products: [watch({ availability: "hidden", stock: 4 })], items: [{ productId: SUBMARINER_ID, quantity: 1 }], unavailable: [SUBMARINER_ID] },
    { name: "sold", products: [watch({ availability: "sold", stock: 4 })], items: [{ productId: SUBMARINER_ID, quantity: 1 }], unavailable: [SUBMARINER_ID] },
    { name: "short of stock", products: [watch({ stock: 1 })], items: [{ productId: SUBMARINER_ID, quantity: 2 }], unavailable: [SUBMARINER_ID] },
    {
      name: "split across two lines that together exceed stock",
      products: [watch({ stock: 3 })],
      items: [
        { productId: SUBMARINER_ID, quantity: 2 },
        { productId: SUBMARINER_ID, quantity: 2 },
      ],
      unavailable: [SUBMARINER_ID],
    },
  ])("reports out_of_stock and keeps stock when a product is $name", async ({ products, items, unavailable }) => {
    const { store, result } = await reserve(products, items);

    expect(result).toEqual({ outcome: "out_of_stock", unavailableProductIds: unavailable });
    for (const product of products) {
      await expect(store.product(product.productId)).resolves.toEqual(product);
    }
    expect(await store.events()).toEqual([]);
  });

  it("returns the first reservation when the same order id is repeated", async () => {
    const store = createInMemoryReservationStore([watch({ stock: 2 })]);
    const dependencies = { store, now: () => NOW, newId: ids(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]) };
    const first = await reserveStock({ orderId: ORDER_ID, items: [{ productId: SUBMARINER_ID, quantity: 1 }], expiresAt: EXPIRES_AT }, dependencies);

    const second = await reserveStock(
      { orderId: ORDER_ID, items: [{ productId: SUBMARINER_ID, quantity: 2 }], expiresAt: new Date("2026-10-14T12:00:00.000Z") },
      { store, now: () => new Date("2026-10-14T11:00:00.000Z"), newId: () => { throw new Error("replay must not allocate an id"); } },
    );

    expect(second).toEqual({ outcome: "replayed", reservation: first.outcome === "reserved" ? first.reservation : undefined });
    await expect(store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 2 });
    expect(await store.events()).toHaveLength(1);
  });

  it("throws when a product disappeared after the stock check", () => {
    expect(() => productAfterStockCheck(new Map(), SUBMARINER_ID)).toThrow(`Product ${SUBMARINER_ID} disappeared after the stock check`);
  });
});
