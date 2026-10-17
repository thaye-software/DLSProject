import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaExpiryStore } from "../../src/adapters/db/prisma-expiry-store.js";
import { PrismaOrderRepository } from "../../src/adapters/db/prisma-order-repository.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { expireDueOrders, orderExpiredEvent } from "../../src/application/expire-orders.js";
import type { OrderStatus } from "../../src/domain/order.js";
import { reservedOrder } from "../fixtures/orders.js";
import { eventSchema } from "../support/contract.js";
import { startMigratedPostgres } from "../support/postgres.js";

const NOW = new Date("2026-10-14T10:30:00Z");

let container: StartedPostgreSqlContainer;
let database: Database;
let orders: PrismaOrderRepository;
let store: PrismaExpiryStore;

beforeAll(async () => {
  container = await startMigratedPostgres();
  database = createDatabase(container.getConnectionUri());
  orders = new PrismaOrderRepository(database);
  store = new PrismaExpiryStore(database);
});

beforeEach(async () => {
  await database.outboxEvent.deleteMany();
  await database.order.deleteMany();
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

async function order(status: OrderStatus, expiresAt: string) {
  const stored = reservedOrder({ id: randomUUID(), status, expiresAt: new Date(expiresAt) });
  await orders.insert(stored, randomUUID());
  return stored;
}

function sweep(on: PrismaExpiryStore = store, limit = 100) {
  return on.expireDue({ now: NOW, limit, buildEvent: (stored) => orderExpiredEvent(stored, NOW, randomUUID) });
}

describe("PrismaExpiryStore.expireDue", () => {
  it("expires only RESERVED orders whose expires_at has passed, at the boundary too", async () => {
    const overdue = await order("RESERVED", "2026-10-14T10:29:00Z");
    const exactlyDue = await order("RESERVED", "2026-10-14T10:30:00Z");
    const notYet = await order("RESERVED", "2026-10-14T10:30:01Z");
    const paid = await order("PENDING", "2026-10-14T10:00:00Z");

    const expired = await sweep();

    expect(expired.sort()).toEqual([overdue.id, exactlyDue.id].sort());
    expect((await orders.findById(overdue.id))?.status).toBe("EXPIRED");
    expect((await orders.findById(exactlyDue.id))?.status).toBe("EXPIRED");
    expect((await orders.findById(notYet.id))?.status).toBe("RESERVED");
    expect((await orders.findById(paid.id))?.status).toBe("PENDING");
  });

  it("writes one contract-valid order_expired per expired order to the outbox", async () => {
    const overdue = await order("RESERVED", "2026-10-14T10:00:00Z");

    await sweep();

    const outbox = await database.outboxEvent.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ type: "order_expired", publishedAt: null });
    const validate = eventSchema("OrderExpiredEvent");
    expect(validate(outbox[0]!.payload), JSON.stringify(validate.errors)).toBe(true);
    expect(outbox[0]!.payload).toMatchObject({ subject: overdue.id, data: { expired_at: "2026-10-14T10:00:00.000Z" } });
  });

  it("expires nothing twice", async () => {
    await order("RESERVED", "2026-10-14T10:00:00Z");

    expect(await sweep()).toHaveLength(1);
    expect(await sweep()).toHaveLength(0);
    expect(await database.outboxEvent.count()).toBe(1);
  });

  it("compares in UTC even when the database session runs in another time zone", async () => {
    // Copenhagen is UTC+2 in October; comparing the UTC column with a local-time value would be 2 hours off.
    const copenhagen = createDatabase(`${container.getConnectionUri()}?options=${encodeURIComponent("-c TimeZone=Europe/Copenhagen")}`);
    try {
      const setting = await copenhagen.$queryRaw<{ TimeZone: string }[]>`SHOW TimeZone`;
      expect(setting[0]?.TimeZone).toBe("Europe/Copenhagen");
      const overdue = await order("RESERVED", "2026-10-14T10:29:59Z");
      const notYet = await order("RESERVED", "2026-10-14T10:30:01Z");

      expect(await sweep(new PrismaExpiryStore(copenhagen))).toEqual([overdue.id]);
      expect((await orders.findById(notYet.id))?.status).toBe("RESERVED");
    } finally {
      await copenhagen.$disconnect();
    }
  });

  it("lets two sweepers run at once without expiring an order twice", async () => {
    for (let index = 0; index < 20; index += 1) await order("RESERVED", "2026-10-14T10:00:00Z");
    const second = createDatabase(container.getConnectionUri());
    try {
      const [a, b] = await Promise.all([
        expireDueOrders({ store, now: () => NOW, newId: randomUUID, batchSize: 3 }),
        expireDueOrders({ store: new PrismaExpiryStore(second), now: () => NOW, newId: randomUUID, batchSize: 3 }),
      ]);

      expect(a + b).toBe(20);
      expect(await database.outboxEvent.count({ where: { type: "order_expired" } })).toBe(20);
      expect(await database.order.count({ where: { status: "EXPIRED" } })).toBe(20);
    } finally {
      await second.$disconnect();
    }
  });
});
