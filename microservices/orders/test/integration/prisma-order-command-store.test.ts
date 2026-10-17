import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaExpiryStore } from "../../src/adapters/db/prisma-expiry-store.js";
import { PrismaOrderCommandStore } from "../../src/adapters/db/prisma-order-command-store.js";
import { PrismaOrderRepository } from "../../src/adapters/db/prisma-order-repository.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { cancelOrder, changeOrderStatus } from "../../src/application/change-order.js";
import { orderExpiredEvent } from "../../src/application/expire-orders.js";
import type { OrderStatus } from "../../src/domain/order.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";
import { startMigratedPostgres } from "../support/postgres.js";

const ADMIN = { userId: "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d", isAdmin: true };
const OWNER = { userId: USER_ID, isAdmin: false };

let container: StartedPostgreSqlContainer;
let database: Database;
let orders: PrismaOrderRepository;
let changes: { store: PrismaOrderCommandStore; now: () => Date; newId: () => string };

beforeAll(async () => {
  container = await startMigratedPostgres();
  database = createDatabase(container.getConnectionUri());
  orders = new PrismaOrderRepository(database);
  changes = { store: new PrismaOrderCommandStore(database), now: () => new Date(), newId: randomUUID };
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

async function storedOrder(status: OrderStatus, expiresAt = new Date(Date.now() + 60_000)) {
  const order = reservedOrder({ id: randomUUID(), status, expiresAt });
  await orders.insert(order, randomUUID());
  return order;
}

const outboxTypes = async (orderId: string) =>
  (await database.outboxEvent.findMany({ where: { payload: { path: ["subject"], equals: orderId } }, orderBy: { createdAt: "asc" } })).map(
    (row) => row.type,
  );

describe("PrismaOrderCommandStore via the use cases", () => {
  it("cancels a RESERVED order and writes order_cancelled to the outbox", async () => {
    const order = await storedOrder("RESERVED");

    const result = await cancelOrder(order.id, OWNER, changes);

    expect(result).toMatchObject({ kind: "done", order: { id: order.id, status: "CANCELLED" } });
    expect((await orders.findById(order.id))?.status).toBe("CANCELLED");
    expect(await outboxTypes(order.id)).toEqual(["order_cancelled"]);
  });

  it("returns a cancelled order unchanged when it is cancelled again, with no new event", async () => {
    const order = await storedOrder("RESERVED");
    await cancelOrder(order.id, OWNER, changes);

    await expect(cancelOrder(order.id, OWNER, changes)).resolves.toMatchObject({ kind: "done", order: { status: "CANCELLED" } });
    expect(await outboxTypes(order.id)).toEqual(["order_cancelled"]);
  });

  it("leaves the order and the outbox untouched when the change is refused", async () => {
    const order = await storedOrder("PENDING");

    await expect(cancelOrder(order.id, OWNER, changes)).resolves.toEqual({ kind: "rejected", reason: "not_cancellable" });
    expect((await orders.findById(order.id))?.status).toBe("PENDING");
    expect(await outboxTypes(order.id)).toEqual([]);
  });

  it("answers not_found for an unknown order", async () => {
    await expect(changeOrderStatus(randomUUID(), "SHIPPED", ADMIN, changes)).resolves.toEqual({ kind: "not_found" });
  });

  it("walks an order forward and refunds it, writing each change's events in order", async () => {
    const order = await storedOrder("PENDING");

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED", "RETURNED", "REFUNDED"] as const) {
      await expect(changeOrderStatus(order.id, status, ADMIN, changes)).resolves.toMatchObject({ kind: "done", order: { status } });
    }

    expect((await orders.findById(order.id))?.status).toBe("REFUNDED");
    expect(await outboxTypes(order.id)).toEqual([
      "order_status_changed",
      "order_status_changed",
      "order_status_changed",
      "order_status_changed",
      "order_status_changed",
      "refund_requested",
    ]);
  });

  it("lets exactly one of a customer cancel and the expiry sweeper win on an overdue order", async () => {
    const order = await storedOrder("RESERVED", new Date(Date.now() - 1000));
    const sweeper = new PrismaExpiryStore(database);
    const now = new Date();

    const [cancel] = await Promise.all([
      cancelOrder(order.id, OWNER, changes),
      sweeper.expireDue({ now, limit: 10, buildEvent: (current) => orderExpiredEvent(current, now, randomUUID) }),
    ]);

    const status = (await orders.findById(order.id))?.status;
    const events = await outboxTypes(order.id);
    if (status === "CANCELLED") {
      expect(cancel).toMatchObject({ kind: "done" });
      expect(events).toEqual(["order_cancelled"]);
    } else {
      expect(status).toBe("EXPIRED");
      expect(cancel).toEqual({ kind: "rejected", reason: "not_cancellable" });
      expect(events).toEqual(["order_expired"]);
    }
  });
});
