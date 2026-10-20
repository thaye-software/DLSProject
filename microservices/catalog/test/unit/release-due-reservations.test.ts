import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryReservationStore } from "../../src/adapters/memory/in-memory-reservation-store.js";
import { startReservationSafetyNet } from "../../src/adapters/safety-net.js";
import { releaseDueReservations } from "../../src/application/release-due-reservations.js";
import { reserveStock } from "../../src/application/reserve-stock.js";
import type { ReserveStockDependencies } from "../../src/application/reserve-stock.js";
import type { Product } from "../../src/domain/product.js";
import type { Reservation } from "../../src/domain/reservation.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const CONFIRMED_ORDER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const SUBMARINER_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const DATEJUST_ID = "1c0d9a3e-6b21-4f0a-9c55-7e2b8d4a1f30";
const RESERVED_AT = new Date("2026-10-14T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-10-14T10:30:00.000Z");
const FIVE_MINUTES_MS = 5 * 60 * 1000;

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

const reserveIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const releaseId = "44444444-4444-4444-8444-444444444444";

function confirmedReservation(): Reservation {
  const product = watch({ productId: DATEJUST_ID, name: "Datejust", stock: 1, version: 2, availability: "available" });
  return {
    reservationId: "33333333-3333-4333-8333-333333333333",
    orderId: CONFIRMED_ORDER_ID,
    status: "confirmed",
    items: [{ productId: DATEJUST_ID, productName: product.name, quantity: 1, unitPrice: product.price, thumbnailUrl: product.thumbnailUrl }],
    expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
  };
}

async function holdOne(): Promise<ReserveStockDependencies> {
  const datejust = watch({ productId: DATEJUST_ID, name: "Datejust", stock: 1, version: 2, availability: "available" });
  const store = createInMemoryReservationStore([watch({ stock: 2 }), datejust], [confirmedReservation()]);
  await reserveStock(
    { orderId: ORDER_ID, items: [{ productId: SUBMARINER_ID, quantity: 1 }], expiresAt: EXPIRES_AT },
    { store, now: () => RESERVED_AT, newId: ids(reserveIds) },
  );
  return { store, now: () => EXPIRES_AT, newId: ids([releaseId]) };
}

describe("releaseDueReservations", () => {
  it("releases a reservation that is still active five minutes after expires_at", async () => {
    const dependencies = await holdOne();
    dependencies.now = () => new Date(EXPIRES_AT.getTime() + FIVE_MINUTES_MS);

    expect(await releaseDueReservations(dependencies)).toBe(1);

    await expect(dependencies.store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    await expect(dependencies.store.product(DATEJUST_ID)).resolves.toMatchObject({ stock: 1, version: 2, availability: "available" });
    const reservations = await dependencies.store.reservations();
    expect(reservations.find((reservation) => reservation.orderId === ORDER_ID)?.status).toBe("released");
    expect(reservations.find((reservation) => reservation.orderId === CONFIRMED_ORDER_ID)?.status).toBe("confirmed");
    const releaseEvent = (await dependencies.store.events()).at(-1);
    expect(releaseEvent?.causationid).toBeNull();
    expect(releaseEvent?.data).toMatchObject({ reason: "order_released", order_id: ORDER_ID });
  });

  it.each([
    { name: "at expires_at", at: EXPIRES_AT },
    { name: "one millisecond before the five minutes elapse", at: new Date(EXPIRES_AT.getTime() + FIVE_MINUTES_MS - 1) },
  ])("leaves the reservation active $name", async ({ at }) => {
    const dependencies = await holdOne();
    dependencies.now = () => at;

    expect(await releaseDueReservations(dependencies)).toBe(0);

    await expect(dependencies.store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 1, version: 2, availability: "reserved" });
    expect((await dependencies.store.reservations()).find((reservation) => reservation.orderId === ORDER_ID)?.status).toBe("active");
    expect(await dependencies.store.events()).toHaveLength(1);
  });

  it("does not add stock when the safety net runs again", async () => {
    const dependencies = await holdOne();
    const due = new Date(EXPIRES_AT.getTime() + FIVE_MINUTES_MS);
    dependencies.now = () => due;

    expect(await releaseDueReservations(dependencies)).toBe(1);
    dependencies.newId = () => {
      throw new Error("a second pass must not allocate an id");
    };
    expect(await releaseDueReservations(dependencies)).toBe(0);

    await expect(dependencies.store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, version: 3 });
    expect(await dependencies.store.events()).toHaveLength(2);
  });
});

describe("startReservationSafetyNet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("releases a due reservation on its first tick", async () => {
    const dependencies = await holdOne();
    dependencies.now = () => new Date(EXPIRES_AT.getTime() + FIVE_MINUTES_MS);

    const poller = startReservationSafetyNet(dependencies, 1000);
    await vi.advanceTimersByTimeAsync(0);

    await expect(dependencies.store.product(SUBMARINER_ID)).resolves.toMatchObject({ stock: 2, availability: "available" });
    await poller.stop();
  });
});
