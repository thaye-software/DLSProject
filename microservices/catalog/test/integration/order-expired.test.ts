import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel } from "amqplib";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { productData } from "../../src/adapters/db/prisma-product-repository.js";
import { PrismaReservationStore } from "../../src/adapters/db/prisma-reservation-store.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { startConsumer, type Consumer } from "../../src/adapters/rabbitmq/consumer.js";
import { createOrderEventHandlers } from "../../src/adapters/rabbitmq/order-events.js";
import {
  assertConsumerTopology,
  CATALOG_ORDER_EVENTS_QUEUE,
  deadLetterQueueFor,
  ORDER_EVENTS_EXCHANGE,
} from "../../src/adapters/rabbitmq/topology.js";
import type { ReservationStore } from "../../src/application/ports/reservation-store.js";
import { releaseDueReservations, SAFETY_NET_GRACE_MS } from "../../src/application/release-due-reservations.js";
import type { Product } from "../../src/domain/product.js";
import { startMigratedPostgres } from "../support/postgres.js";
import { startRabbitMq } from "../support/rabbitmq.js";

const FAST_RETRIES = [5, 5, 5, 5, 5];
const BROKER_WAIT = { timeout: 10_000 };
const DEAD_LETTER_QUEUE = deadLetterQueueFor(CATALOG_ORDER_EVENTS_QUEUE);
const NOW = new Date("2026-10-14T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-10-14T10:30:00.000Z");

let postgres: StartedPostgreSqlContainer;
let rabbit: StartedRabbitMQContainer;
let database: Database;
let publisherConnection: ChannelModel;
let publisher: Channel;
let consumerConnection: BrokerConnection | undefined;
let consumer: Consumer | undefined;

beforeAll(async () => {
  [postgres, rabbit] = await Promise.all([startMigratedPostgres(), startRabbitMq()]);
  database = createDatabase(postgres.getConnectionUri());
  publisherConnection = await connect(rabbit.getAmqpUrl());
  publisher = await publisherConnection.createChannel();
});

afterEach(async () => {
  await consumer?.stop().catch(() => undefined);
  consumer = undefined;
  await consumerConnection?.close().catch(() => undefined);
  consumerConnection = undefined;
});

afterAll(async () => {
  await publisherConnection?.close();
  await database?.$disconnect();
  await Promise.all([postgres?.stop(), rabbit?.stop()]);
});

function watch(): Product {
  const productId = randomUUID();
  return {
    productId,
    name: "Rolex Submariner Date 126610LN",
    slug: `watch-${productId}`,
    brandName: "Rolex",
    model: "Submariner Date",
    price: { amountMinor: 11_500_000, currency: "DKK" },
    availability: "reserved",
    thumbnailUrl: null,
    stock: 1,
    version: 2,
  };
}

async function insertActive(product: Product): Promise<string> {
  const orderId = randomUUID();
  await database.product.create({ data: productData(product) });
  await database.reservation.create({
    data: {
      id: randomUUID(),
      orderId,
      status: "active",
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
  return orderId;
}

function countingStore(attempts: { count: number }): { store: PrismaReservationStore; counting: ReservationStore } {
  const store = new PrismaReservationStore(database);
  const counting: ReservationStore = {
    reserve: store.reserve.bind(store),
    release: store.release.bind(store),
    confirm: store.confirm.bind(store),
    cancel: store.cancel.bind(store),
    expire: (id, event, decide) => {
      attempts.count += 1;
      return store.expire(id, event, decide);
    },
    reservations: store.reservations.bind(store),
    product: store.product.bind(store),
    events: store.events.bind(store),
  };
  return { store, counting };
}

async function consume(store: ReservationStore): Promise<void> {
  const handlers = createOrderEventHandlers({ store, now: () => new Date("2026-10-14T10:30:00.000Z"), newId: randomUUID });
  consumerConnection = await connectToBroker(rabbit.getAmqpUrl());
  await assertConsumerTopology(consumerConnection.channel, {
    exchange: ORDER_EVENTS_EXCHANGE,
    queue: CATALOG_ORDER_EVENTS_QUEUE,
    routingKeys: Object.keys(handlers),
  });
  await publisher.purgeQueue(CATALOG_ORDER_EVENTS_QUEUE);
  await publisher.purgeQueue(DEAD_LETTER_QUEUE);
  consumer = await startConsumer(consumerConnection.channel, {
    queue: CATALOG_ORDER_EVENTS_QUEUE,
    handlers,
    retryDelaysMs: FAST_RETRIES,
  });
}

function publish(orderId: string, eventId: string): void {
  const body = {
    specversion: "1.0",
    id: eventId,
    source: "/services/orders",
    type: "order_expired",
    time: "2026-10-14T10:30:00Z",
    data: { order_id: orderId },
  };
  publisher.publish(ORDER_EVENTS_EXCHANGE, "order_expired", Buffer.from(JSON.stringify(body)), { persistent: true });
}

describe("order_expired", () => {
  it("returns stock for an active reservation", async () => {
    const product = watch();
    const orderId = await insertActive(product);
    const eventId = randomUUID();
    const attempts = { count: 0 };
    const { store, counting } = countingStore(attempts);
    await consume(counting);

    publish(orderId, eventId);

    await vi.waitFor(async () => {
      expect(attempts.count).toBeGreaterThan(0);
      expect(await database.reservation.findUnique({ where: { orderId } })).toMatchObject({ status: "released" });
    }, BROKER_WAIT);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    expect((await store.events()).filter((event) => event.correlationid === orderId)).toEqual([
      expect.objectContaining({
        causationid: eventId,
        data: expect.objectContaining({ reason: "order_released", stock: 2 }),
      }),
    ]);
    expect(await database.processedEvent.findUnique({ where: { eventId } })).toMatchObject({ type: "order_expired" });
  });

  it("adds nothing after the safety-net poller has released the reservation", async () => {
    const product = watch();
    const orderId = await insertActive(product);
    const eventId = randomUUID();
    const store = new PrismaReservationStore(database);
    const dueAt = new Date(EXPIRES_AT.getTime() + SAFETY_NET_GRACE_MS);
    expect(await releaseDueReservations({ store, now: () => dueAt, newId: randomUUID })).toBe(1);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });

    const attempts = { count: 0 };
    const counting: ReservationStore = {
      reserve: store.reserve.bind(store),
      release: store.release.bind(store),
      confirm: store.confirm.bind(store),
      cancel: store.cancel.bind(store),
      expire: (id, event, decide) => {
        attempts.count += 1;
        return store.expire(id, event, decide);
      },
      reservations: store.reservations.bind(store),
      product: store.product.bind(store),
      events: store.events.bind(store),
    };
    await consume(counting);

    publish(orderId, eventId);

    await vi.waitFor(() => expect(attempts.count).toBe(1), BROKER_WAIT);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 2, version: 3, availability: "available" });
    const events = (await store.events()).filter((event) => event.correlationid === orderId);
    expect(events).toHaveLength(1);
    expect(events[0]?.causationid).toBeNull();
    expect(await database.processedEvent.findUnique({ where: { eventId } })).toBeNull();
    expect((await publisher.checkQueue(CATALOG_ORDER_EVENTS_QUEUE)).messageCount).toBe(0);
    expect((await publisher.checkQueue(DEAD_LETTER_QUEUE)).messageCount).toBe(0);
  });
});
