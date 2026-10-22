import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel, type GetMessage } from "amqplib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../../src/adapters/db/prisma.js";
import { createDatabase } from "../../src/adapters/db/prisma.js";
import { startOutboxRelay, type OutboxRelay } from "../../src/adapters/outbox-relay.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { CATALOG_EVENTS_EXCHANGE, createEventPublisher, type EventPublisher } from "../../src/adapters/rabbitmq/publisher.js";
import { availabilityEvent } from "../../src/domain/availability-event.js";
import { startMigratedPostgres } from "../support/postgres.js";
import { startRabbitMq } from "../support/rabbitmq.js";

const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const QUIET_INTERVAL_MS = 60_000;

const payload = availabilityEvent({
  id: EVENT_ID,
  productId: PRODUCT_ID,
  orderId: ORDER_ID,
  time: new Date("2026-10-14T10:00:05.000Z"),
  version: 5,
  availability: "reserved",
  previousAvailability: "available",
  stock: 0,
  reason: "order_reserved",
  causationId: null,
});

let postgres: StartedPostgreSqlContainer;
let rabbit: StartedRabbitMQContainer;
let database: Database;
let observer: ChannelModel;
let broker: BrokerConnection;
let publisher: EventPublisher;
let queue: string;

beforeAll(async () => {
  [postgres, rabbit] = await Promise.all([startMigratedPostgres(), startRabbitMq()]);
  database = createDatabase(postgres.getConnectionUri());
  observer = await connect(rabbit.getAmqpUrl());
});

afterAll(async () => {
  await observer?.close().catch(() => undefined);
  await database?.$disconnect();
  await Promise.all([postgres?.stop(), rabbit?.stop()]);
});

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await database.outboxEvent.deleteMany();
  broker = await connectToBroker(rabbit.getAmqpUrl());
  publisher = await createEventPublisher(broker.channel);
  const channel = await observer.createChannel();
  ({ queue } = await channel.assertQueue("", { exclusive: true }));
  await channel.bindQueue(queue, CATALOG_EVENTS_EXCHANGE, payload.type);
  await channel.close();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await broker?.close().catch(() => undefined);
});

async function nextMessage(): Promise<GetMessage | false> {
  const channel = await observer.createChannel();
  try {
    return await channel.get(queue, { noAck: true });
  } finally {
    await channel.close();
  }
}

async function insertPending(): Promise<void> {
  await database.outboxEvent.create({ data: { id: payload.id, type: payload.type, payload } });
}

describe("outbox relay", () => {
  it("publishes a pending row, marks it, and publishes nothing on the next pass", async () => {
    await insertPending();
    const relay = startOutboxRelay({ database, publisher, intervalMs: QUIET_INTERVAL_MS });
    await relay.stop();

    const message = await nextMessage();
    if (!message) throw new Error(`no message on ${queue}`);
    expect(message.fields).toMatchObject({ exchange: CATALOG_EVENTS_EXCHANGE, routingKey: payload.type });
    expect(message.properties).toMatchObject({ contentType: "application/cloudevents+json", deliveryMode: 2, messageId: payload.id });
    expect(JSON.parse(message.content.toString("utf8"))).toEqual(payload);

    const stored = await database.outboxEvent.findUniqueOrThrow({ where: { id: payload.id } });
    expect(stored.publishedAt).toBeInstanceOf(Date);

    await expect(relay.publishPending()).resolves.toBe(0);
    expect(await nextMessage()).toBe(false);
  });

  it("leaves published_at null when the broker rejects the confirm", async () => {
    await insertPending();
    const channel: Channel = broker.channel;
    const { queue: full } = await channel.assertQueue("", {
      exclusive: true,
      arguments: { "x-max-length": 0, "x-overflow": "reject-publish" },
    });
    await channel.bindQueue(full, CATALOG_EVENTS_EXCHANGE, payload.type);

    const relay: OutboxRelay = startOutboxRelay({ database, publisher, intervalMs: QUIET_INTERVAL_MS });
    await relay.stop();

    await expect(relay.publishPending()).rejects.toThrow();
    const stored = await database.outboxEvent.findUniqueOrThrow({ where: { id: payload.id } });
    expect(stored.publishedAt).toBeNull();
  });
});
