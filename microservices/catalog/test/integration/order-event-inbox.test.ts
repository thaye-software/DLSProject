import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel } from "amqplib";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaOrderEventInbox } from "../../src/adapters/db/prisma-order-event-inbox.js";
import { productData } from "../../src/adapters/db/prisma-product-repository.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { startConsumer, type Consumer } from "../../src/adapters/rabbitmq/consumer.js";
import { orderEventHandler } from "../../src/adapters/rabbitmq/order-events.js";
import {
  assertConsumerTopology,
  CATALOG_ORDER_EVENTS_QUEUE,
  deadLetterQueueFor,
  ORDER_EVENTS_EXCHANGE,
} from "../../src/adapters/rabbitmq/topology.js";
import type { OrderEventInbox } from "../../src/application/ports/order-event-inbox.js";
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
let inbox: PrismaOrderEventInbox;
let publisherConnection: ChannelModel;
let publisher: Channel;
let consumerConnection: BrokerConnection | undefined;
let consumer: Consumer | undefined;

beforeAll(async () => {
  [postgres, rabbit] = await Promise.all([startMigratedPostgres(), startRabbitMq()]);
  database = createDatabase(postgres.getConnectionUri());
  inbox = new PrismaOrderEventInbox(database);
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

function watch(overrides: Partial<Product> = {}): Product {
  const productId = overrides.productId ?? randomUUID();
  return {
    productId,
    name: "Rolex Submariner Date 126610LN",
    slug: `watch-${productId}`,
    brandName: "Rolex",
    model: "Submariner Date",
    price: { amountMinor: 11_500_000, currency: "DKK" },
    availability: "reserved",
    thumbnailUrl: null,
    stock: 2,
    version: 2,
    ...overrides,
  };
}

async function insertHeldProduct(): Promise<{ product: Product; orderId: string }> {
  const product = watch();
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
  return { product, orderId };
}

async function messageCount(queue: string): Promise<number> {
  return (await publisher.checkQueue(queue)).messageCount;
}

async function consume(changeStock: Parameters<OrderEventInbox["apply"]>[1], target: OrderEventInbox = inbox): Promise<void> {
  consumerConnection = await connectToBroker(rabbit.getAmqpUrl());
  await assertConsumerTopology(consumerConnection.channel, {
    exchange: ORDER_EVENTS_EXCHANGE,
    queue: CATALOG_ORDER_EVENTS_QUEUE,
    routingKeys: [],
  });
  await publisher.purgeQueue(CATALOG_ORDER_EVENTS_QUEUE);
  await publisher.purgeQueue(DEAD_LETTER_QUEUE);
  consumer = await startConsumer(consumerConnection.channel, {
    queue: CATALOG_ORDER_EVENTS_QUEUE,
    handlers: { order_confirmed: orderEventHandler(target, changeStock) },
    retryDelaysMs: FAST_RETRIES,
  });
}

function publish(orderId: string, eventId = randomUUID()): string {
  const body = {
    specversion: "1.0",
    id: eventId,
    source: "/services/orders",
    type: "order_confirmed",
    time: "2026-10-14T10:04:10Z",
    data: { order_id: orderId },
  };
  publisher.sendToQueue(CATALOG_ORDER_EVENTS_QUEUE, Buffer.from(JSON.stringify(body)), { persistent: true });
  return eventId;
}

describe("processed order events", () => {
  it("stores the CloudEvents id in the same transaction as the stock change", async () => {
    const { product, orderId } = await insertHeldProduct();
    const eventId = randomUUID();
    await consume(async (reservation, stock) => {
      const line = reservation.items[0];
      if (!line) throw new Error("reservation has no lines");
      await stock.setStock(line.productId, 0);
    });

    publish(orderId, eventId);

    await vi.waitFor(async () => {
      expect(await database.product.findUnique({ where: { id: product.productId } })).toMatchObject({ stock: 0 });
      expect(await database.processedEvent.findUnique({ where: { eventId } })).toMatchObject({ type: "order_confirmed" });
    }, BROKER_WAIT);
    await consumer?.stop();
    consumer = undefined;
    expect(await messageCount(CATALOG_ORDER_EVENTS_QUEUE)).toBe(0);
    expect(await messageCount(DEAD_LETTER_QUEUE)).toBe(0);
  });

  it("leaves no processed_events row when the handler rolls back", async () => {
    const { product, orderId } = await insertHeldProduct();
    const eventId = randomUUID();
    const changeStock = vi.fn(async () => {
      throw new Error("stock update failed");
    });
    await consume(changeStock);

    publish(orderId, eventId);

    await vi.waitFor(async () => expect(await messageCount(DEAD_LETTER_QUEUE)).toBe(1), BROKER_WAIT);
    expect(changeStock).toHaveBeenCalledTimes(6);
    expect(await database.processedEvent.findUnique({ where: { eventId } })).toBeNull();
    expect(await database.product.findUnique({ where: { id: product.productId } })).toMatchObject({ stock: 2 });
  });

  it("acks a published event for an unknown order without a processed row or a stock change", async () => {
    const { product } = await insertHeldProduct();
    const eventId = randomUUID();
    const changeStock = vi.fn(async () => undefined);
    let applies = 0;
    const counting: OrderEventInbox = {
      apply: async (event, handle) => {
        const result = await inbox.apply(event, handle);
        applies += 1;
        return result;
      },
    };
    await consume(changeStock, counting);

    publish(randomUUID(), eventId);

    await vi.waitFor(() => expect(applies).toBe(1), BROKER_WAIT);
    expect(changeStock).not.toHaveBeenCalled();
    await consumerConnection?.close();
    consumerConnection = undefined;
    expect(await messageCount(CATALOG_ORDER_EVENTS_QUEUE)).toBe(0);
    expect(await messageCount(DEAD_LETTER_QUEUE)).toBe(0);
    expect(await database.processedEvent.findUnique({ where: { eventId } })).toBeNull();
    expect(await database.product.findUnique({ where: { id: product.productId } })).toMatchObject({ stock: 2 });
  });
});
