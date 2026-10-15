import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type ChannelModel, type GetMessage } from "amqplib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { createEventPublisher } from "../../src/adapters/rabbitmq/publisher.js";
import type { EventPublisher } from "../../src/application/ports/event-publisher.js";
import { buildPaymentEvent } from "../../src/domain/payment-event.js";
import { ORDER_ID, paymentCompleteData, paymentFailedData } from "../fixtures/payment-events.js";
import { startRabbitMq } from "../support/rabbitmq.js";

const EXCHANGE = "payment.events";

let container: StartedRabbitMQContainer;
let observer: ChannelModel;
let broker: BrokerConnection;
let publisher: EventPublisher;
let queue: string;

const event = buildPaymentEvent({
  stripeEventId: "evt_3Q0abc",
  type: "payment_complete",
  orderId: ORDER_ID,
  time: new Date("2026-10-14T10:04:09Z"),
  data: paymentCompleteData,
});

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
  await channel.bindQueue(queue, EXCHANGE, "payment_complete");
  await channel.close();
});

afterEach(async () => {
  await broker.close().catch(() => undefined);
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

describe("createEventPublisher", () => {
  it("declares payment.events as a durable topic exchange", async () => {
    const channel = await observer.createChannel();

    await expect(channel.assertExchange(EXCHANGE, "topic", { durable: true })).resolves.toMatchObject({ exchange: EXCHANGE });
    await channel.close();
  });

  it("delivers the event to a queue bound to its type, as a persistent CloudEvent", async () => {
    await publisher.publish(event);

    const message = await nextMessage();
    expect(message.fields).toMatchObject({ exchange: EXCHANGE, routingKey: "payment_complete" });
    expect(message.properties).toMatchObject({
      contentType: "application/cloudevents+json",
      deliveryMode: 2,
      messageId: event.id,
    });
    expect(JSON.parse(message.content.toString("utf8"))).toEqual(event);
  });

  it("fails when the broker refuses the message", async () => {
    const channel = await observer.createChannel();
    const { queue: full } = await channel.assertQueue("", {
      exclusive: true,
      arguments: { "x-max-length": 0, "x-overflow": "reject-publish" },
    });
    await channel.bindQueue(full, EXCHANGE, "payment_failed");
    await channel.close();

    const failed = buildPaymentEvent({
      stripeEventId: "evt_3Q0abd",
      type: "payment_failed",
      orderId: ORDER_ID,
      time: new Date("2026-10-14T10:03:01Z"),
      data: paymentFailedData,
    });

    await expect(publisher.publish(failed)).rejects.toThrow();
  });

  it("fails after the connection is closed", async () => {
    await broker.close();

    await expect(publisher.publish(event)).rejects.toThrow();
  });
});
