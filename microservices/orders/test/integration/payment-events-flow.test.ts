import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel, type ConsumeMessage } from "amqplib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaOrderEventStore } from "../../src/adapters/db/prisma-order-event-store.js";
import { PrismaOrderRepository } from "../../src/adapters/db/prisma-order-repository.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { startOutboxRelay, type OutboxRelay } from "../../src/adapters/outbox-relay.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { startConsumer, type Consumer } from "../../src/adapters/rabbitmq/consumer.js";
import { createPaymentEventHandlers, PAYMENT_EVENTS_EXCHANGE, PAYMENT_EVENTS_QUEUE } from "../../src/adapters/rabbitmq/payment-events.js";
import { createEventPublisher, ORDER_EVENTS_EXCHANGE } from "../../src/adapters/rabbitmq/publisher.js";
import { assertConsumerTopology } from "../../src/adapters/rabbitmq/topology.js";
import { reservedOrder, USER_ID } from "../fixtures/orders.js";
import { eventSchema } from "../support/contract.js";
import { startMigratedPostgres } from "../support/postgres.js";
import { startRabbitMq } from "../support/rabbitmq.js";

const BROKER_WAIT = { timeout: 15_000 };

let postgres: StartedPostgreSqlContainer;
let rabbit: StartedRabbitMQContainer;
let database: Database;
let orders: PrismaOrderRepository;
let broker: BrokerConnection;
let relay: OutboxRelay;
let consumer: Consumer;
// A plain client standing in for Payment (publishing) and for order.events consumers (Notif, Catalog).
let testConnection: ChannelModel;
let testChannel: Channel;
const orderEvents: ConsumeMessage[] = [];

beforeAll(async () => {
  [postgres, rabbit] = await Promise.all([startMigratedPostgres(), startRabbitMq()]);
  database = createDatabase(postgres.getConnectionUri());
  orders = new PrismaOrderRepository(database);

  testConnection = await connect(rabbit.getAmqpUrl());
  testChannel = await testConnection.createChannel();
  await testChannel.assertExchange(ORDER_EVENTS_EXCHANGE, "topic", { durable: true });
  const { queue } = await testChannel.assertQueue("", { exclusive: true });
  await testChannel.bindQueue(queue, ORDER_EVENTS_EXCHANGE, "#");
  await testChannel.consume(queue, (message) => message && orderEvents.push(message), { noAck: true });

  // Wired as in main.ts, with a short relay interval.
  broker = await connectToBroker(rabbit.getAmqpUrl());
  relay = startOutboxRelay({ database, publisher: await createEventPublisher(broker.channel), intervalMs: 50 });
  const handlers = createPaymentEventHandlers({ store: new PrismaOrderEventStore(database), now: () => new Date(), newId: randomUUID });
  await assertConsumerTopology(broker.channel, { exchange: PAYMENT_EVENTS_EXCHANGE, queue: PAYMENT_EVENTS_QUEUE, routingKeys: Object.keys(handlers) });
  consumer = await startConsumer(broker.channel, { queue: PAYMENT_EVENTS_QUEUE, handlers, retryDelaysMs: [10, 10] });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterAll(async () => {
  await consumer?.stop();
  await relay?.stop();
  await broker?.close();
  await testConnection?.close();
  await database?.$disconnect();
  await Promise.all([postgres?.stop(), rabbit?.stop()]);
});

async function storedOrder(status: "RESERVED" | "EXPIRED" = "RESERVED") {
  const order = reservedOrder({ id: randomUUID(), status });
  await orders.insert(order, randomUUID());
  return order;
}

function publishPaymentEvent(type: string, data: Record<string, unknown>, id = randomUUID()): string {
  const event = { specversion: "1.0", id, source: "/services/payment", type, time: new Date().toISOString(), data };
  testChannel.publish(PAYMENT_EVENTS_EXCHANGE, type, Buffer.from(JSON.stringify(event)), { persistent: true });
  return id;
}

function paymentComplete(orderId: string) {
  return {
    payment_intent_id: "pi_3Q0abc",
    order_id: orderId,
    user_id: USER_ID,
    amount: { amount_minor: 11_530_000, currency: "DKK" },
    paid_at: new Date().toISOString(),
  };
}

const eventsFor = (orderId: string) =>
  orderEvents.map((message) => JSON.parse(message.content.toString())).filter((event) => event.subject === orderId);

describe("payment.events → Orders → order.events", () => {
  it("confirms a paid order and publishes a contract-valid order_confirmed on order.events", async () => {
    const order = await storedOrder();

    publishPaymentEvent("payment_complete", paymentComplete(order.id));

    await vi.waitFor(() => expect(eventsFor(order.id)).toHaveLength(1), BROKER_WAIT);
    const [event] = eventsFor(order.id);
    const validate = eventSchema("OrderConfirmedEvent");
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
    expect((await orders.findById(order.id))?.status).toBe("PENDING");
    const message = orderEvents.find((candidate) => candidate.properties.messageId === event.id)!;
    expect(message.fields.routingKey).toBe("order_confirmed");
    expect(message.properties.contentType).toBe("application/cloudevents+json");
  });

  it("handles a redelivered event once", async () => {
    const order = await storedOrder();
    const eventId = randomUUID();

    publishPaymentEvent("payment_complete", paymentComplete(order.id), eventId);
    publishPaymentEvent("payment_complete", paymentComplete(order.id), eventId);

    await vi.waitFor(() => expect(eventsFor(order.id)).toHaveLength(1), BROKER_WAIT);
    await vi.waitFor(async () => expect(await database.processedEvent.count({ where: { eventId } })).toBe(1), BROKER_WAIT);
    // Give a wrongly handled second copy time to show up.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(eventsFor(order.id)).toHaveLength(1);
  });

  it("requests a refund for a payment that arrives after the order expired", async () => {
    const order = await storedOrder("EXPIRED");

    publishPaymentEvent("payment_complete", paymentComplete(order.id));

    await vi.waitFor(() => expect(eventsFor(order.id)).toHaveLength(1), BROKER_WAIT);
    const [event] = eventsFor(order.id);
    expect(event).toMatchObject({ type: "refund_requested", data: { reason: "paid_after_expiry" } });
    const validate = eventSchema("RefundRequestedEvent");
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
    expect((await orders.findById(order.id))?.status).toBe("EXPIRED");
  });

  it("sets REFUNDED when Payment reports the refund", async () => {
    const order = await storedOrder("EXPIRED");

    publishPaymentEvent("payment_refunded", {
      payment_intent_id: "pi_3Q0abc",
      order_id: order.id,
      user_id: USER_ID,
      refund_request_id: randomUUID(),
      amount: { amount_minor: 11_530_000, currency: "DKK" },
      stripe_refund_id: "re_3Q0abc",
      refunded_at: new Date().toISOString(),
    });

    await vi.waitFor(async () => expect((await orders.findById(order.id))?.status).toBe("REFUNDED"), BROKER_WAIT);
  });

  it("dead-letters a payment event for an order Orders doesn't know", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    publishPaymentEvent("payment_complete", paymentComplete(randomUUID()));

    await vi.waitFor(
      async () => expect((await testChannel.checkQueue(`${PAYMENT_EVENTS_QUEUE}.dlq`)).messageCount).toBe(1),
      BROKER_WAIT,
    );
  });
});

describe("outbox relay", () => {
  it("marks published rows and publishes nothing twice", async () => {
    await vi.waitFor(async () => expect(await database.outboxEvent.count({ where: { publishedAt: null } })).toBe(0), BROKER_WAIT);
    const published = orderEvents.length;

    await expect(relay.publishPending()).resolves.toBe(0);
    expect(orderEvents.length).toBe(published);
  });

  it("publishes rows in the order they were written", async () => {
    const subject = randomUUID();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, id] of ids.entries()) {
      await database.outboxEvent.create({
        data: {
          id,
          type: "order_status_changed",
          payload: { id, subject, type: "order_status_changed", data: { index } },
          createdAt: new Date(Date.now() + index),
        },
      });
    }

    await vi.waitFor(() => expect(eventsFor(subject)).toHaveLength(3), BROKER_WAIT);
    expect(eventsFor(subject).map((event) => event.id)).toEqual(ids);
  });
});
