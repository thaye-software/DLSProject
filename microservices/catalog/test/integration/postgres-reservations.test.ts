import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaProductRepository, productData } from "../../src/adapters/db/prisma-product-repository.js";
import { PrismaReservationStore } from "../../src/adapters/db/prisma-reservation-store.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { seedCatalog, seededProduct, SEEDED_PRODUCT_ID } from "../../src/adapters/db/seed.js";
import { getProduct } from "../../src/application/get-product.js";
import type { ReserveRequest } from "../../src/application/ports/reservation-store.js";
import { releaseDueReservations } from "../../src/application/release-due-reservations.js";
import { releaseReservation } from "../../src/application/release-reservation.js";
import { reserveStock, type ReserveStockDependencies } from "../../src/application/reserve-stock.js";
import type { Product } from "../../src/domain/product.js";
import { INTERNAL_JWT_SECRET, serve } from "../support/serve.js";
import { startMigratedPostgres } from "../support/postgres.js";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-10-14T10:30:00.000Z");
const FIVE_MINUTES_MS = 5 * 60 * 1000;

let container: StartedPostgreSqlContainer;
let database: Database;
let products: PrismaProductRepository;
let store: PrismaReservationStore;

beforeAll(async () => {
  container = await startMigratedPostgres();
  database = createDatabase(container.getConnectionUri());
  products = new PrismaProductRepository(database);
  store = new PrismaReservationStore(database);
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

function watch(overrides: Partial<Product> = {}): Product {
  const productId = overrides.productId ?? randomUUID();
  return {
    productId,
    name: "Rolex Submariner Date 126610LN",
    slug: `watch-${productId}`,
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

function context(now: Date): ReserveStockDependencies {
  return { store, now: () => now, newId: randomUUID };
}

async function insertProduct(product: Product): Promise<Product> {
  await database.product.create({ data: productData(product) });
  return product;
}

async function eventsFor(orderId: string) {
  return (await store.events()).filter((event) => event.correlationid === orderId);
}

async function reserve(product: Product, quantity = 1, orderId = randomUUID(), expiresAt = EXPIRES_AT) {
  const result = await reserveStock({ orderId, items: [{ productId: product.productId, quantity }], expiresAt }, context(NOW));
  return { orderId, result };
}

function serviceToken(): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("orders")
    .setAudience("catalog")
    .setIssuedAt(iat)
    .setExpirationTime(iat + 60)
    .sign(new TextEncoder().encode(INTERNAL_JWT_SECRET));
}

function httpCatalog() {
  return {
    reserveStock: (request: ReserveRequest) => reserveStock(request, context(NOW)),
    releaseReservation: (orderId: string) => releaseReservation(orderId, context(NOW)),
  };
}

describe("Postgres products, reservations, and the availability outbox", () => {
  it("inserts one available product from the seed", async () => {
    const before = await database.product.count();

    await seedCatalog(database);
    await seedCatalog(database);

    expect(await database.product.count()).toBe(before + 1);
    expect(await database.product.count({ where: { id: SEEDED_PRODUCT_ID, availability: "available" } })).toBe(1);
    await expect(getProduct(SEEDED_PRODUCT_ID, products)).resolves.toEqual(seededProduct);
  });

  it("reads a stored product, including a hidden one", async () => {
    const visible = await insertProduct(watch());
    const hidden = await insertProduct(watch({ brandName: null, model: null, availability: "hidden", thumbnailUrl: null }));

    await expect(getProduct(visible.productId, products)).resolves.toEqual(visible);
    await expect(getProduct(hidden.productId, products)).resolves.toEqual(hidden);
  });

  it("writes the stock change and one outbox row together when a reserve commits", async () => {
    const product = await insertProduct(watch({ stock: 2 }));

    const { orderId, result } = await reserve(product);

    expect(result.outcome).toBe("reserved");
    const stored = (await store.reservations()).find((reservation) => reservation.orderId === orderId);
    expect(stored).toMatchObject({
      orderId,
      status: "active",
      expiresAt: EXPIRES_AT,
      createdAt: NOW,
      items: [
        {
          productId: product.productId,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          thumbnailUrl: product.thumbnailUrl,
        },
      ],
    });
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 1, version: 2, availability: "reserved" });
    const events = await eventsFor(orderId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "product_availability_changed",
      subject: product.productId,
      correlationid: orderId,
      causationid: null,
      data: {
        product_id: product.productId,
        version: 2,
        availability: "reserved",
        previous_availability: "available",
        stock: 1,
        reason: "order_reserved",
        order_id: orderId,
      },
    });
  });

  it("leaves stock and the outbox unchanged when the reserve is out of stock", async () => {
    const product = await insertProduct(watch({ stock: 0 }));
    const before = await store.events();

    const result = await reserveStock(
      { orderId: randomUUID(), items: [{ productId: product.productId, quantity: 1 }], expiresAt: EXPIRES_AT },
      context(NOW),
    );

    expect(result).toEqual({ outcome: "out_of_stock", unavailableProductIds: [product.productId] });
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 0, version: 1, availability: "available" });
    expect(await store.events()).toEqual(before);
  });

  it("does not decrement stock when the same order id is reserved again", async () => {
    const product = await insertProduct(watch({ stock: 2 }));
    const orderId = randomUUID();
    await reserve(product, 1, orderId);

    const again = await reserveStock(
      { orderId, items: [{ productId: product.productId, quantity: 2 }], expiresAt: new Date("2026-11-01T00:00:00.000Z") },
      context(NOW),
    );

    expect(again.outcome).toBe("replayed");
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 1, version: 2, availability: "reserved" });
    expect(await eventsFor(orderId)).toHaveLength(1);
  });

  it("returns the reserved quantity once when an active reservation is released", async () => {
    const product = await insertProduct(watch({ stock: 2 }));
    const { orderId } = await reserve(product);

    const released = await releaseReservation(orderId, context(new Date("2026-10-14T10:05:00.000Z")));

    expect(released.outcome).toBe("released");
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect((await eventsFor(orderId)).map((event) => event.data.reason)).toEqual(["order_reserved", "order_released"]);
  });

  it("does not add stock when a reservation is released a second time", async () => {
    const product = await insertProduct(watch({ stock: 2 }));
    const { orderId } = await reserve(product);
    await releaseReservation(orderId, context(NOW));

    const again = await releaseReservation(orderId, context(NOW));

    expect(again.outcome).toBe("already_released");
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect(await eventsFor(orderId)).toHaveLength(2);
  });

  it("does not add stock when a confirmed reservation is released", async () => {
    const product = await insertProduct(watch({ stock: 1 }));
    const orderId = randomUUID();
    await database.reservation.create({
      data: {
        id: randomUUID(),
        orderId,
        status: "confirmed",
        expiresAt: EXPIRES_AT,
        createdAt: NOW,
        items: {
          create: [
            {
              position: 0,
              productId: product.productId,
              productName: product.name,
              quantity: 1,
              unitPriceDkk: BigInt(product.price.amountMinor),
              thumbnailUrl: product.thumbnailUrl,
            },
          ],
        },
      },
    });

    const result = await releaseReservation(orderId, context(NOW));

    expect(result.outcome).toBe("confirmed");
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 1, version: 1, availability: "available" });
    expect(await eventsFor(orderId)).toEqual([]);
  });

  it("releases a reservation that is still active five minutes after expires_at", async () => {
    const product = await insertProduct(watch({ stock: 2 }));
    const expiresAt = new Date("2020-01-01T00:00:00.000Z");
    const { orderId } = await reserve(product, 1, randomUUID(), expiresAt);

    const released = await releaseDueReservations({
      store,
      now: () => new Date(expiresAt.getTime() + FIVE_MINUTES_MS),
      newId: randomUUID,
    });

    expect(released).toBe(1);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect((await store.reservations()).find((reservation) => reservation.orderId === orderId)?.status).toBe("released");
  });

  it("writes stock and the outbox when POST /internal/reservations answers 201", async () => {
    const product = await insertProduct(watch({ stock: 2 }));
    const orderId = randomUUID();
    const baseUrl = await serve(httpCatalog());

    const response = await fetch(`${baseUrl}/internal/reservations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await serviceToken()}`,
        "content-type": "application/json",
        "idempotency-key": orderId,
      },
      body: JSON.stringify({
        order_id: orderId,
        items: [{ product_id: product.productId, quantity: 1 }],
        expires_at: EXPIRES_AT.toISOString(),
      }),
    });

    expect(response.status).toBe(201);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 1, version: 2, availability: "reserved" });
    expect(await eventsFor(orderId)).toHaveLength(1);
  });

  it("leaves stock and the outbox unchanged when POST /internal/reservations answers 409", async () => {
    const product = await insertProduct(watch({ stock: 0 }));
    const before = await store.events();
    const orderId = randomUUID();
    const baseUrl = await serve(httpCatalog());

    const response = await fetch(`${baseUrl}/internal/reservations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await serviceToken()}`,
        "content-type": "application/json",
        "idempotency-key": orderId,
      },
      body: JSON.stringify({
        order_id: orderId,
        items: [{ product_id: product.productId, quantity: 1 }],
        expires_at: EXPIRES_AT.toISOString(),
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ unavailable_product_ids: [product.productId] });
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 0, version: 1, availability: "available" });
    expect(await store.events()).toEqual(before);
  });

  it("returns the stock when DELETE /internal/reservations answers 204", async () => {
    const product = await insertProduct(watch({ stock: 2 }));
    const { orderId } = await reserve(product);
    const baseUrl = await serve(httpCatalog());

    const response = await fetch(`${baseUrl}/internal/reservations/${orderId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${await serviceToken()}` },
    });

    expect(response.status).toBe(204);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
  });
});
