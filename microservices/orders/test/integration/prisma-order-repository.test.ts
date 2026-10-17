import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaOrderRepository } from "../../src/adapters/db/prisma-order-repository.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { address, IDEMPOTENCY_KEY, reservedOrder, USER_ID } from "../fixtures/orders.js";
import { startMigratedPostgres } from "../support/postgres.js";

let container: StartedPostgreSqlContainer;
let database: Database;
let repository: PrismaOrderRepository;

beforeAll(async () => {
  container = await startMigratedPostgres();
  database = createDatabase(container.getConnectionUri());
  repository = new PrismaOrderRepository(database);
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

let next = 0;
// Every test gets its own order id and key so they don't collide in the shared database.
function freshIds() {
  next += 1;
  const suffix = String(next).padStart(12, "0");
  return { id: `f47ac10b-58cc-4372-a567-${suffix}`, key: `1f0e2d3c-4b5a-4968-8776-${suffix}` };
}

describe("PrismaOrderRepository", () => {
  it("finds a stored order by user and Idempotency-Key, with its lines and addresses", async () => {
    const { id, key } = freshIds();
    const order = reservedOrder({ id, deliveryAddress: { ...address, addressLine2: "2. tv", city: "Aarhus C" } });

    await expect(repository.insert(order, key)).resolves.toEqual({ kind: "inserted" });

    await expect(repository.findByIdempotencyKey(USER_ID, key)).resolves.toEqual(order);
  });

  it("returns null for a key that was never used", async () => {
    await expect(repository.findByIdempotencyKey(USER_ID, IDEMPOTENCY_KEY)).resolves.toBeNull();
  });

  it("reports a duplicate for the same order id", async () => {
    const { id, key } = freshIds();
    await repository.insert(reservedOrder({ id }), key);

    await expect(repository.insert(reservedOrder({ id }), freshIds().key)).resolves.toEqual({ kind: "duplicate" });
  });

  it("reports a duplicate for the same user and Idempotency-Key", async () => {
    const { id, key } = freshIds();
    await repository.insert(reservedOrder({ id }), key);

    await expect(repository.insert(reservedOrder({ id: freshIds().id }), key)).resolves.toEqual({ kind: "duplicate" });
  });

  it("leaves nothing behind when the insert is a duplicate", async () => {
    const { id, key } = freshIds();
    await repository.insert(reservedOrder({ id }), key);
    const addressesBefore = await database.orderAddress.count();

    await repository.insert(reservedOrder({ id }), freshIds().key);

    expect(await database.orderAddress.count()).toBe(addressesBefore);
  });

  it("finds an order by id, and returns null for an unknown id", async () => {
    const { id, key } = freshIds();
    const order = reservedOrder({ id });
    await repository.insert(order, key);

    await expect(repository.findById(id)).resolves.toEqual(order);
    await expect(repository.findById(freshIds().id)).resolves.toBeNull();
  });
});

describe("PrismaOrderRepository.list", () => {
  // A user of its own, so orders from the other tests don't show up.
  const LIST_USER_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
  const created: string[] = [];

  beforeAll(async () => {
    // Five orders a minute apart, alternating status; the newest is the last one.
    for (let minute = 0; minute < 5; minute += 1) {
      const { id, key } = freshIds();
      const status = minute % 2 === 0 ? "PENDING" : "SHIPPED";
      await repository.insert(
        reservedOrder({ id, userId: LIST_USER_ID, status, createdAt: new Date(Date.UTC(2026, 9, 14, 10, minute)) }),
        key,
      );
      created.push(id);
    }
  });

  const newestFirst = () => [...created].reverse();

  it("lists one user's orders newest first with the total", async () => {
    const page = await repository.list({ userId: LIST_USER_ID, statuses: [], page: 1, pageSize: 20 });

    expect(page.total).toBe(5);
    expect(page.orders.map((order) => order.id)).toEqual(newestFirst());
  });

  it("pages without overlap or gaps", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) => repository.list({ userId: LIST_USER_ID, statuses: [], page, pageSize: 2 })),
    );

    expect(pages.map((page) => page.orders.length)).toEqual([2, 2, 1]);
    expect(pages.flatMap((page) => page.orders.map((order) => order.id))).toEqual(newestFirst());
    expect(pages.every((page) => page.total === 5)).toBe(true);
  });

  it("returns an empty page past the end, with the total", async () => {
    await expect(repository.list({ userId: LIST_USER_ID, statuses: [], page: 9, pageSize: 20 })).resolves.toEqual({
      orders: [],
      total: 5,
    });
  });

  it.each([
    { statuses: ["PENDING" as const], count: 3 },
    { statuses: ["SHIPPED" as const], count: 2 },
    { statuses: ["PENDING" as const, "SHIPPED" as const], count: 5 },
    { statuses: ["DELIVERED" as const], count: 0 },
  ])("filters on $statuses", async ({ statuses, count }) => {
    const page = await repository.list({ userId: LIST_USER_ID, statuses, page: 1, pageSize: 20 });

    expect(page.total).toBe(count);
    expect(page.orders.every((order) => statuses.includes(order.status as never))).toBe(true);
  });

  it("lists every user's orders when no user is given (admin)", async () => {
    const page = await repository.list({ userId: null, statuses: [], page: 1, pageSize: 100 });

    expect(page.total).toBeGreaterThan(5);
    expect(new Set(page.orders.map((order) => order.userId)).size).toBeGreaterThan(1);
  });
});
