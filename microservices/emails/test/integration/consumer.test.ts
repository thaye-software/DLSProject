import { randomUUID } from "node:crypto";
import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel } from "amqplib";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { handleEvent, startConsumer, type EventHandler } from "../../src/adapters/rabbitmq/consumer.js";
import { assertConsumerTopology } from "../../src/adapters/rabbitmq/topology.js";

const ORDER_EVENTS = "order.events";
const FAST_RETRIES = [5, 5, 5, 5, 5];

let container: StartedRabbitMQContainer;
let publisherConnection: ChannelModel;
let publisher: Channel;
let consumerConnection: BrokerConnection | undefined;

beforeAll(async () => {
  container = await new RabbitMQContainer("rabbitmq:4-management-alpine").start();
  publisherConnection = await connect(container.getAmqpUrl());
  publisher = await publisherConnection.createChannel();
});

afterEach(async () => {
  await consumerConnection?.close().catch(() => undefined);
  consumerConnection = undefined;
});

afterAll(async () => {
  await publisherConnection?.close();
  await container?.stop();
});

function orderConfirmed(overrides: Record<string, unknown> = {}) {
  return {
    specversion: "1.0",
    id: randomUUID(),
    source: "/services/orders",
    type: "order_confirmed",
    time: "2026-10-14T10:04:10Z",
    data: { order_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
    ...overrides,
  };
}

function publish(routingKey: string, body: unknown): void {
  const content = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  publisher.publish(ORDER_EVENTS, routingKey, content, { persistent: true });
}

async function messageCount(queue: string): Promise<number> {
  return (await publisher.checkQueue(queue)).messageCount;
}

function orderHandler(handle: (data: { order_id: string }) => Promise<void>): EventHandler {
  return handleEvent(z.object({ order_id: z.uuid() }), handle);
}

async function consume(handlers: Record<string, EventHandler>): Promise<string> {
  const queue = `notif.test.${randomUUID()}`;
  consumerConnection = await connectToBroker(container.getAmqpUrl());
  await assertConsumerTopology(consumerConnection.channel, { exchange: ORDER_EVENTS, queue, routingKeys: ["order_confirmed"] });
  await startConsumer(consumerConnection.channel, { queue, handlers, retryDelaysMs: FAST_RETRIES });
  return queue;
}

async function closeConsumerSoUnackedMessagesReturn(): Promise<void> {
  await consumerConnection?.close();
  consumerConnection = undefined;
}

async function management(path: string): Promise<any> {
  const url = `http://${container.getHost()}:${container.getMappedPort(15672)}/api/${path}`;
  const response = await fetch(url, { headers: { authorization: `Basic ${btoa("guest:guest")}` } });
  expect(response.status).toBe(200);
  return response.json();
}

describe("assertConsumerTopology", () => {
  it("declares Notif's exchanges, quorum queues, dead-lettering and bindings", async () => {
    const connection = await connectToBroker(container.getAmqpUrl());
    const topology = { exchange: ORDER_EVENTS, queue: "notif.order.events", routingKeys: ["order_confirmed"] };
    await assertConsumerTopology(connection.channel, topology);
    await assertConsumerTopology(connection.channel, topology);
    await connection.close();

    expect(await management("exchanges/%2F/order.events")).toMatchObject({ type: "topic", durable: true });
    expect(await management("exchanges/%2F/dlx")).toMatchObject({ type: "direct", durable: true });
    expect(await management("queues/%2F/notif.order.events")).toMatchObject({
      type: "quorum",
      durable: true,
      arguments: { "x-dead-letter-exchange": "dlx", "x-dead-letter-routing-key": "notif.order.events" },
    });
    expect(await management("queues/%2F/notif.order.events.dlq")).toMatchObject({ type: "quorum", durable: true });
    expect(await management("queues/%2F/notif.order.events/bindings")).toContainEqual(
      expect.objectContaining({ source: "order.events", routing_key: "order_confirmed" }),
    );
    expect(await management("queues/%2F/notif.order.events.dlq/bindings")).toContainEqual(
      expect.objectContaining({ source: "dlx", routing_key: "notif.order.events" }),
    );
  });
});

describe("startConsumer", () => {
  it("hands a valid event to its handler once and acks it", async () => {
    const handle = vi.fn(async () => undefined);
    const queue = await consume({ order_confirmed: orderHandler(handle) });

    publish("order_confirmed", orderConfirmed());

    await vi.waitFor(() => expect(handle).toHaveBeenCalledOnce());
    expect(handle).toHaveBeenCalledWith({ order_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }, expect.objectContaining({ type: "order_confirmed" }));
    await closeConsumerSoUnackedMessagesReturn();
    expect(await messageCount(queue)).toBe(0);
    expect(await messageCount(`${queue}.dlq`)).toBe(0);
  });

  it("only receives the routing keys it is bound to", async () => {
    const handle = vi.fn(async () => undefined);
    await consume({ order_confirmed: orderHandler(handle) });

    publish("order_cancelled", orderConfirmed({ type: "order_cancelled" }));
    publish("order_confirmed", orderConfirmed());

    await vi.waitFor(() => expect(handle).toHaveBeenCalledOnce());
    expect(handle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "order_confirmed" }));
  });

  it("retries a failing handler and acks once it succeeds", async () => {
    let attempts = 0;
    const handle = vi.fn(async () => {
      attempts += 1;
      if (attempts <= 2) throw new Error("Resend is down");
    });
    const queue = await consume({ order_confirmed: orderHandler(handle) });

    publish("order_confirmed", orderConfirmed());

    await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(3));
    await closeConsumerSoUnackedMessagesReturn();
    expect(await messageCount(queue)).toBe(0);
    expect(await messageCount(`${queue}.dlq`)).toBe(0);
  });

  it("dead-letters the event after 1 attempt and 5 retries all fail", async () => {
    const handle = vi.fn(async () => Promise.reject(new Error("Resend is down")));
    const queue = await consume({ order_confirmed: orderHandler(handle) });
    const event = orderConfirmed();

    publish("order_confirmed", event);

    await vi.waitFor(async () => expect(await messageCount(`${queue}.dlq`)).toBe(1));
    expect(handle).toHaveBeenCalledTimes(6);
    const deadLetter = await publisher.get(`${queue}.dlq`, { noAck: true });
    expect(deadLetter && JSON.parse(deadLetter.content.toString()).id).toBe(event.id);
  });

  it.each([
    { name: "body is not JSON", routingKey: "order_confirmed", body: Buffer.from("order confirmed") },
    { name: "CloudEvent without id", routingKey: "order_confirmed", body: (({ id: _id, ...rest }) => rest)(orderConfirmed()) },
    { name: "data fails the handler's schema", routingKey: "order_confirmed", body: orderConfirmed({ data: { order_id: "not-a-uuid" } }) },
  ])("dead-letters at once without calling the handler: $name", async ({ routingKey, body }) => {
    const handle = vi.fn(async () => undefined);
    const queue = await consume({ order_confirmed: orderHandler(handle) });

    publish(routingKey, body);

    await vi.waitFor(async () => expect(await messageCount(`${queue}.dlq`)).toBe(1));
    expect(handle).not.toHaveBeenCalled();
  });

  it("dead-letters an event type that has no handler", async () => {
    const handle = vi.fn(async () => undefined);
    const queue = await consume({ order_confirmed: orderHandler(handle) });

    publisher.sendToQueue(queue, Buffer.from(JSON.stringify(orderConfirmed({ type: "order_expired" }))));

    await vi.waitFor(async () => expect(await messageCount(`${queue}.dlq`)).toBe(1));
    expect(handle).not.toHaveBeenCalled();
  });
});
