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
    availability: "sold",
    thumbnailUrl: null,
    stock: 0,
    version: 3,
  };
}

async function insertConfirmed(product: Product): Promise<string> {
  const orderId = randomUUID();
  await database.product.create({ data: productData(product) });
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
  return orderId;
}

async function messageCount(queue: string): Promise<number> {
  return (await publisher.checkQueue(queue)).messageCount;
}

async function consume(store: ReservationStore): Promise<void> {
  const handlers = createOrderEventHandlers({ store, now: () => new Date("2026-10-14T12:00:00.000Z"), newId: randomUUID });
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

function publish(orderId: string, eventId: string, previousStatus: string, status: string): void {
  const body = {
    specversion: "1.0",
    id: eventId,
    source: "/services/orders",
    type: "order_status_changed",
    time: "2026-10-14T12:00:00Z",
    data: { order_id: orderId, previous_status: previousStatus, status },
  };
  publisher.publish(ORDER_EVENTS_EXCHANGE, "order_status_changed", Buffer.from(JSON.stringify(body)), { persistent: true });
}

describe("order_status_changed", () => {
  it("returns stock when DELIVERED becomes RETURNED, and REFUNDED after that adds nothing", async () => {
    const product = watch();
    const orderId = await insertConfirmed(product);
    const returnedEventId = randomUUID();
    const refundedEventId = randomUUID();
    const store = new PrismaReservationStore(database);
    const attempts = { count: 0 };
    const counting: ReservationStore = {
      reserve: store.reserve.bind(store),
      release: store.release.bind(store),
      confirm: store.confirm.bind(store),
      expire: store.expire.bind(store),
      cancel: (id, event, decide) => {
        attempts.count += 1;
        return store.cancel(id, event, decide);
      },
      reservations: store.reservations.bind(store),
      product: store.product.bind(store),
      events: store.events.bind(store),
    };
    await consume(counting);

    publish(orderId, returnedEventId, "DELIVERED", "RETURNED");

    await vi.waitFor(async () => {
      expect(attempts.count).toBeGreaterThan(0);
      expect(await database.reservation.findUnique({ where: { orderId } })).toMatchObject({ status: "released" });
    }, BROKER_WAIT);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 1, version: 4, availability: "available" });
    expect((await store.events()).filter((event) => event.correlationid === orderId)).toEqual([
      expect.objectContaining({
        type: "product_availability_changed",
        subject: product.productId,
        correlationid: orderId,
        causationid: returnedEventId,
        data: expect.objectContaining({ reason: "order_released", stock: 1, availability: "available" }),
      }),
    ]);
    expect(await database.processedEvent.findUnique({ where: { eventId: returnedEventId } })).toMatchObject({
      type: "order_status_changed",
    });

    const afterReturn = attempts.count;
    publish(orderId, refundedEventId, "RETURNED", "REFUNDED");

    await vi.waitFor(() => expect(attempts.count).toBeGreaterThan(afterReturn), BROKER_WAIT);
    await expect(store.product(product.productId)).resolves.toMatchObject({ stock: 1, version: 4, availability: "available" });
    expect((await store.events()).filter((event) => event.correlationid === orderId)).toHaveLength(1);
    expect(await database.processedEvent.findUnique({ where: { eventId: refundedEventId } })).toBeNull();
    expect(await database.reservation.findUnique({ where: { orderId } })).toMatchObject({ status: "released" });
    expect(await messageCount(CATALOG_ORDER_EVENTS_QUEUE)).toBe(0);
    expect(await messageCount(DEAD_LETTER_QUEUE)).toBe(0);
  });
});
