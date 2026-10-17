import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaOrderEventStore } from "../../src/adapters/db/prisma-order-event-store.js";
import { PrismaOrderRepository } from "../../src/adapters/db/prisma-order-repository.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { decidePaymentComplete } from "../../src/application/handle-payment-events.js";
import type { Decision } from "../../src/application/ports/order-event-store.js";
import { buildOrderEvent, orderConfirmedData } from "../../src/domain/order-event.js";
import type { Order } from "../../src/domain/order.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";
import { startMigratedPostgres } from "../support/postgres.js";

let container: StartedPostgreSqlContainer;
let database: Database;
let store: PrismaOrderEventStore;
let orders: PrismaOrderRepository;

beforeAll(async () => {
  container = await startMigratedPostgres();
  database = createDatabase(container.getConnectionUri());
  store = new PrismaOrderEventStore(database);
  orders = new PrismaOrderRepository(database);
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

async function storedOrder(): Promise<Order> {
  const order = reservedOrder({ id: randomUUID() });
  await orders.insert(order, randomUUID());
  return order;
}

function confirm(order: Order): Decision {
  const event = buildOrderEvent({
    id: randomUUID(),
    type: "order_confirmed",
    orderId: order.id,
    time: new Date(),
    causationId: null,
    data: orderConfirmedData(order, new Date()),
  });
  return { status: "PENDING", publish: [event], note: "confirmed" };
}

const outboxFor = (orderId: string) =>
  database.outboxEvent.findMany({ where: { payload: { path: ["subject"], equals: orderId } } });

describe("PrismaOrderEventStore.apply", () => {
  it("changes the status, stores the events in the outbox and records the event id, together", async () => {
    const order = await storedOrder();
    const eventId = randomUUID();
    let published: Decision["publish"] = [];

    const result = await store.apply({
      eventId,
      eventType: "payment_complete",
      orderId: order.id,
      decide: (current) => {
        const decision = confirm(current);
        published = decision.publish;
        return decision;
      },
    });

    expect(result).toEqual({ kind: "applied", note: "confirmed" });
    expect((await orders.findById(order.id))?.status).toBe("PENDING");
    const outbox = await outboxFor(order.id);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ id: published[0]!.id, type: "order_confirmed", publishedAt: null });
    expect(outbox[0]!.payload).toEqual(published[0]);
    expect(await database.processedEvent.findUnique({ where: { eventId } })).toMatchObject({ type: "payment_complete" });
  });

  it("skips an event id it has already handled without deciding again", async () => {
    const order = await storedOrder();
    const eventId = randomUUID();
    await store.apply({ eventId, eventType: "payment_complete", orderId: order.id, decide: confirm });
    const decide = vi.fn(confirm);

    await expect(store.apply({ eventId, eventType: "payment_complete", orderId: order.id, decide })).resolves.toEqual({
      kind: "duplicate",
    });
    expect(decide).not.toHaveBeenCalled();
    expect(await outboxFor(order.id)).toHaveLength(1);
  });

  it("throws for an unknown order and does not record the event id, so a retry can still handle it", async () => {
    const eventId = randomUUID();

    await expect(
      store.apply({ eventId, eventType: "payment_complete", orderId: randomUUID(), decide: confirm }),
    ).rejects.toThrow(/not found/);
    expect(await database.processedEvent.findUnique({ where: { eventId } })).toBeNull();
  });

  it("rolls everything back when the decision throws", async () => {
    const order = await storedOrder();
    const eventId = randomUUID();

    await expect(
      store.apply({
        eventId,
        eventType: "payment_complete",
        orderId: order.id,
        decide: () => {
          throw new Error("decision failed");
        },
      }),
    ).rejects.toThrow("decision failed");
    expect(await database.processedEvent.findUnique({ where: { eventId } })).toBeNull();
    expect((await orders.findById(order.id))?.status).toBe("RESERVED");
  });

  it("confirms an order once when two different payment_complete events race", async () => {
    const order = await storedOrder();
    const payment = {
      payment_intent_id: "pi_3Q0abc",
      order_id: order.id,
      user_id: USER_ID,
      amount: { amount_minor: order.totalPriceDkk, currency: "DKK" },
      paid_at: new Date().toISOString(),
    };
    const handle = (eventId: string) =>
      store.apply({
        eventId,
        eventType: "payment_complete",
        orderId: order.id,
        decide: (current) => decidePaymentComplete(current, payment, eventId, new Date(), randomUUID),
      });

    // The loser either reads PENDING and ignores the payment, or read RESERVED and fails its
    // conditional update (rolled back, retried by the consumer). Either way: one confirmation.
    await Promise.allSettled([handle(randomUUID()), handle(randomUUID())]);

    expect((await orders.findById(order.id))?.status).toBe("PENDING");
    expect((await outboxFor(order.id)).filter((row) => row.type === "order_confirmed")).toHaveLength(1);
  });
});
