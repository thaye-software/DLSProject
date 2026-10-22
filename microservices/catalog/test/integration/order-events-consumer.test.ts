import { randomUUID } from "node:crypto";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel } from "amqplib";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { handleEvent, startConsumer, type Consumer } from "../../src/adapters/rabbitmq/consumer.js";
import {
  assertConsumerTopology,
  CATALOG_ORDER_EVENTS_QUEUE,
  deadLetterQueueFor,
  ORDER_EVENTS_EXCHANGE,
} from "../../src/adapters/rabbitmq/topology.js";
import { startRabbitMq } from "../support/rabbitmq.js";

const FAST_RETRIES = [5, 5, 5, 5, 5];
const BROKER_WAIT = { timeout: 10_000 };
const DEAD_LETTER_QUEUE = deadLetterQueueFor(CATALOG_ORDER_EVENTS_QUEUE);

let container: StartedRabbitMQContainer;
let publisherConnection: ChannelModel;
let publisher: Channel;
let consumerConnection: BrokerConnection | undefined;
let consumer: Consumer | undefined;

beforeAll(async () => {
  container = await startRabbitMq("rabbitmq:4-management-alpine");
  publisherConnection = await connect(container.getAmqpUrl());
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
  await container?.stop();
});

async function messageCount(queue: string): Promise<number> {
  return (await publisher.checkQueue(queue)).messageCount;
}

async function management(path: string): Promise<unknown> {
  const url = `http://${container.getHost()}:${container.getMappedPort(15672)}/api/${path}`;
  const response = await fetch(url, { headers: { authorization: `Basic ${btoa("guest:guest")}` } });
  expect(response.status).toBe(200);
  return response.json();
}

async function consume(handle: () => Promise<void>): Promise<void> {
  consumerConnection = await connectToBroker(container.getAmqpUrl());
  await assertConsumerTopology(consumerConnection.channel, {
    exchange: ORDER_EVENTS_EXCHANGE,
    queue: CATALOG_ORDER_EVENTS_QUEUE,
    routingKeys: [],
  });
  await publisher.purgeQueue(CATALOG_ORDER_EVENTS_QUEUE);
  await publisher.purgeQueue(DEAD_LETTER_QUEUE);
  consumer = await startConsumer(consumerConnection.channel, {
    queue: CATALOG_ORDER_EVENTS_QUEUE,
    handlers: { order_confirmed: handleEvent(z.object({ order_id: z.uuid() }), handle) },
    retryDelaysMs: FAST_RETRIES,
  });
}

function cloudEvent(data: unknown = { order_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }) {
  return {
    specversion: "1.0",
    id: randomUUID(),
    source: "/services/orders",
    type: "order_confirmed",
    time: "2026-10-14T10:04:10Z",
    data,
  };
}

describe("catalog.order.events", () => {
  it("retries a throwing handler 5 times and then dead-letters it", async () => {
    const handle = vi.fn(async () => Promise.reject(new Error("stock update failed")));
    await consume(handle);
    const event = cloudEvent();

    publisher.sendToQueue(CATALOG_ORDER_EVENTS_QUEUE, Buffer.from(JSON.stringify(event)), { persistent: true });

    await vi.waitFor(async () => expect(await messageCount(DEAD_LETTER_QUEUE)).toBe(1), BROKER_WAIT);
    expect(handle).toHaveBeenCalledTimes(6);
    expect(await management(`queues/%2F/${encodeURIComponent(CATALOG_ORDER_EVENTS_QUEUE)}`)).toMatchObject({
      type: "quorum",
      durable: true,
      arguments: { "x-dead-letter-exchange": "dlx", "x-dead-letter-routing-key": CATALOG_ORDER_EVENTS_QUEUE },
    });
    expect(await management(`queues/%2F/${encodeURIComponent(DEAD_LETTER_QUEUE)}`)).toMatchObject({ type: "quorum", durable: true });
    const bindings = (await management(`queues/%2F/${encodeURIComponent(CATALOG_ORDER_EVENTS_QUEUE)}/bindings`)) as Array<{
      source: string;
    }>;
    expect(bindings.some((binding) => binding.source === ORDER_EVENTS_EXCHANGE)).toBe(false);
  });

  it("dead-letters a body that is not a valid CloudEvent without retrying", async () => {
    const handle = vi.fn(async () => undefined);
    await consume(handle);

    publisher.sendToQueue(CATALOG_ORDER_EVENTS_QUEUE, Buffer.from("not-json"), { persistent: true });

    await vi.waitFor(async () => expect(await messageCount(DEAD_LETTER_QUEUE)).toBe(1), BROKER_WAIT);
    expect(handle).not.toHaveBeenCalled();
  });
});
