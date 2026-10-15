import { randomUUID } from "node:crypto";
import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type ChannelModel } from "amqplib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connectToBroker } from "../../src/adapters/rabbitmq/connection.js";
import { handleEvent, startConsumer } from "../../src/adapters/rabbitmq/consumer.js";
import { orderConfirmedDataSchema } from "../../src/adapters/rabbitmq/order-confirmed.js";
import { assertConsumerTopology } from "../../src/adapters/rabbitmq/topology.js";
import { ResendMailer } from "../../src/adapters/resend/resend-mailer.js";
import { sendOrderConfirmation } from "../../src/application/send-order-confirmation.js";
import { orderConfirmedEvent } from "../fixtures/order-confirmed.js";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const QUEUE = "notif.order.events";

let container: StartedRabbitMQContainer;
let publisherConnection: ChannelModel;

beforeAll(async () => {
  container = await new RabbitMQContainer("rabbitmq:4-alpine").start();
  publisherConnection = await connect(container.getAmqpUrl());
});

afterAll(async () => {
  await publisherConnection?.close();
  await container?.stop();
});

describe("order_confirmed → order confirmation email", () => {
  it.skipIf(!apiKey)("sends the contract's example event through Resend and acks it", async () => {
    const mailer = new ResendMailer({ apiKey: apiKey!, fromEmail });
    const send = vi.spyOn(mailer, "send");
    const broker = await connectToBroker(container.getAmqpUrl());
    const ack = vi.spyOn(broker.channel, "ack");
    await assertConsumerTopology(broker.channel, { exchange: "order.events", queue: QUEUE, routingKeys: ["order_confirmed"] });
    await startConsumer(broker.channel, {
      queue: QUEUE,
      handlers: {
        order_confirmed: handleEvent(orderConfirmedDataSchema, (order, event) => sendOrderConfirmation(order, event.id, mailer)),
      },
      retryDelaysMs: [],
    });
    const event = {
      ...orderConfirmedEvent,
      id: randomUUID(),
      data: { ...orderConfirmedEvent.data, customer_email: "delivered@resend.dev" },
    };

    const publisher = await publisherConnection.createChannel();
    publisher.publish("order.events", "order_confirmed", Buffer.from(JSON.stringify(event)), { persistent: true });

    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce(), { timeout: 15_000 });
    await expect(send.mock.results[0]!.value).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "delivered@resend.dev", idempotencyKey: event.id }),
    );
    await vi.waitFor(() => expect(ack).toHaveBeenCalledOnce());
    await broker.close();
    expect((await publisher.checkQueue(QUEUE)).messageCount).toBe(0);
    expect((await publisher.checkQueue(`${QUEUE}.dlq`)).messageCount).toBe(0);
  });
});
