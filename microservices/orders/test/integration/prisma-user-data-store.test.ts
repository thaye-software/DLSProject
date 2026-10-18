import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaExpiryStore } from "../../src/adapters/db/prisma-expiry-store.js";
import { PrismaOrderRepository } from "../../src/adapters/db/prisma-order-repository.js";
import { orderExpiredEvent } from "../../src/application/expire-orders.js";
import { PrismaUserDataStore } from "../../src/adapters/db/prisma-user-data-store.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { ANONYMISED, onUserDeleted } from "../../src/application/anonymise-user.js";
import type { OrderStatus } from "../../src/domain/order.js";
import { address, reservedOrder } from "../fixtures/orders.js";
import { eventSchema } from "../support/contract.js";
import { startMigratedPostgres } from "../support/postgres.js";

let container: StartedPostgreSqlContainer;
let database: Database;
let orders: PrismaOrderRepository;
let deps: { store: PrismaUserDataStore; now: () => Date; newId: () => string };

beforeAll(async () => {
  container = await startMigratedPostgres();
  database = createDatabase(container.getConnectionUri());
  orders = new PrismaOrderRepository(database);
  deps = { store: new PrismaUserDataStore(database), now: () => new Date(), newId: randomUUID };
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

const deliveryAddress = { ...address, middleName: "Marie", addressLine2: "2. tv", city: "Aarhus C", zipCode: "8000" };

async function orderOf(userId: string, status: OrderStatus = "PENDING") {
  const order = reservedOrder({ id: randomUUID(), userId, status, deliveryAddress });
  await orders.insert(order, randomUUID());
  return order;
}

async function outboxRow(orderId: string, published: boolean) {
  const id = randomUUID();
  await database.outboxEvent.create({
    data: {
      id,
      type: "order_confirmed",
      payload: { id, subject: orderId, data: { customer_email: "mette@example.com" } },
      publishedAt: published ? new Date() : null,
    },
  });
  return id;
}

describe("PrismaUserDataStore.anonymiseUser", () => {
  it("replaces email, names and street on all the user's orders, and keeps the rest", async () => {
    const userId = randomUUID();
    const [first, second] = [await orderOf(userId), await orderOf(userId)];

    await expect(onUserDeleted(userId, randomUUID(), deps)).resolves.toEqual({ kind: "applied", orders: 2, cancelled: 0 });

    for (const original of [first, second]) {
      const order = await orders.findById(original.id);
      expect(order).toMatchObject({ userId, status: "PENDING", totalPriceDkk: original.totalPriceDkk, customerEmail: ANONYMISED.customerEmail });
      const anonymised = { firstName: "Deleted", middleName: null, lastName: "User", addressLine1: "Deleted", addressLine2: null };
      expect(order?.billingAddress).toEqual({ ...address, ...anonymised });
      // City, zip code and country stay for statistics.
      expect(order?.deliveryAddress).toEqual({ ...deliveryAddress, ...anonymised });
    }
  });

  it("leaves other users' orders alone", async () => {
    const other = await orderOf(randomUUID());

    await onUserDeleted(randomUUID(), randomUUID(), deps);
    await onUserDeleted((await orderOf(randomUUID())).userId, randomUUID(), deps);

    expect(await orders.findById(other.id)).toEqual(other);
  });

  it("deletes the user's published outbox rows and keeps the unpublished ones and other users' rows", async () => {
    const userId = randomUUID();
    const order = await orderOf(userId);
    const otherOrder = await orderOf(randomUUID());
    const published = await outboxRow(order.id, true);
    const pending = await outboxRow(order.id, false);
    const othersPublished = await outboxRow(otherOrder.id, true);

    await onUserDeleted(userId, randomUUID(), deps);

    const remaining = (await database.outboxEvent.findMany({ where: { id: { in: [published, pending, othersPublished] } } })).map(
      (row) => row.id,
    );
    expect(remaining.sort()).toEqual([pending, othersPublished].sort());
  });

  it("skips an event id it has already handled", async () => {
    const userId = randomUUID();
    const eventId = randomUUID();
    await orderOf(userId);
    await onUserDeleted(userId, eventId, deps);

    await expect(onUserDeleted(userId, eventId, deps)).resolves.toEqual({ kind: "duplicate" });
  });

  it("succeeds for a user without orders", async () => {
    await expect(onUserDeleted(randomUUID(), randomUUID(), deps)).resolves.toEqual({ kind: "applied", orders: 0, cancelled: 0 });
  });

  it("cancels the user's unpaid orders with a contract-valid order_cancelled, and leaves paid ones", async () => {
    const userId = randomUUID();
    const unpaid = await orderOf(userId, "RESERVED");
    const paid = await orderOf(userId, "SHIPPED");
    const alreadyExpired = await orderOf(userId, "EXPIRED");

    await expect(onUserDeleted(userId, randomUUID(), deps)).resolves.toEqual({ kind: "applied", orders: 3, cancelled: 1 });

    expect((await orders.findById(unpaid.id))?.status).toBe("CANCELLED");
    expect((await orders.findById(paid.id))?.status).toBe("SHIPPED");
    expect((await orders.findById(alreadyExpired.id))?.status).toBe("EXPIRED");
    // Unpublished, so it survives the clean-up of the user's outbox rows.
    const outbox = await database.outboxEvent.findMany({ where: { payload: { path: ["subject"], equals: unpaid.id } } });
    expect(outbox.map((row) => row.type)).toEqual(["order_cancelled"]);
    const validate = eventSchema("OrderCancelledEvent");
    expect(validate(outbox[0]!.payload), JSON.stringify(validate.errors)).toBe(true);
    expect(outbox[0]!.payload).toMatchObject({ data: { reason: "customer_request", was_paid: false, previous_status: "RESERVED" } });
  });

  it("does not cancel the unpaid orders of other users", async () => {
    const other = await orderOf(randomUUID(), "RESERVED");

    await onUserDeleted(randomUUID(), randomUUID(), deps);

    expect((await orders.findById(other.id))?.status).toBe("RESERVED");
  });

  it("lets exactly one of user_deleted and the expiry sweeper close an overdue order", async () => {
    const userId = randomUUID();
    const order = reservedOrder({ id: randomUUID(), userId, expiresAt: new Date(Date.now() - 1000) });
    await orders.insert(order, randomUUID());
    const now = new Date();

    await Promise.all([
      onUserDeleted(userId, randomUUID(), deps),
      new PrismaExpiryStore(database).expireDue({ now, limit: 10, buildEvent: (current) => orderExpiredEvent(current, now, randomUUID) }),
    ]);

    const status = (await orders.findById(order.id))?.status;
    const events = (await database.outboxEvent.findMany({ where: { payload: { path: ["subject"], equals: order.id } } })).map((row) => row.type);
    expect(events).toEqual([status === "CANCELLED" ? "order_cancelled" : "order_expired"]);
    expect(["CANCELLED", "EXPIRED"]).toContain(status);
  });
});
