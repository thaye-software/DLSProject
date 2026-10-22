import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type ChannelModel, type GetMessage } from "amqplib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { CATALOG_EVENTS_EXCHANGE, createEventPublisher, type EventPublisher } from "../../src/adapters/rabbitmq/publisher.js";
import { availabilityEvent } from "../../src/domain/availability-event.js";
import { startRabbitMq } from "../support/rabbitmq.js";

const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";

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

let container: StartedRabbitMQContainer;
let observer: ChannelModel;
let broker: BrokerConnection;
let publisher: EventPublisher;
let queue: string;

beforeAll(async () => {
  container = await startRabbitMq();
  observer = await connect(container.getAmqpUrl());
});

afterAll(async () => {
  await observer?.close().catch(() => undefined);
  await container?.stop().catch(() => undefined);
});

beforeEach(async () => {
  broker = await connectToBroker(container.getAmqpUrl());
  publisher = await createEventPublisher(broker.channel);
  const channel = await observer.createChannel();
  ({ queue } = await channel.assertQueue("", { exclusive: true }));
  await channel.bindQueue(queue, CATALOG_EVENTS_EXCHANGE, payload.type);
  await channel.close();
});

afterEach(async () => {
  await broker?.close().catch(() => undefined);
});

async function nextMessage(): Promise<GetMessage> {
  const channel = await observer.createChannel();
  try {
    const message = await channel.get(queue, { noAck: true });
    if (!message) throw new Error(`no message on ${queue}`);
    return message;
  } finally {
    await channel.close();
  }
}

describe("catalog.events", () => {
  it("delivers product_availability_changed only after the broker confirms it", async () => {
    const channel = await observer.createChannel();
    await expect(channel.assertExchange(CATALOG_EVENTS_EXCHANGE, "topic", { durable: true })).resolves.toMatchObject({
      exchange: CATALOG_EVENTS_EXCHANGE,
    });
    await channel.close();

    await publisher.publish({ id: payload.id, type: payload.type, payload });

    const message = await nextMessage();
    expect(message.fields).toMatchObject({ exchange: CATALOG_EVENTS_EXCHANGE, routingKey: payload.type });
    expect(message.properties).toMatchObject({
      contentType: "application/cloudevents+json",
      deliveryMode: 2,
      messageId: payload.id,
    });
    const body = JSON.parse(message.content.toString("utf8")) as typeof payload;
    expect(body.type).toBe(message.fields.routingKey);
    expect(body).toEqual(payload);
  });
});
