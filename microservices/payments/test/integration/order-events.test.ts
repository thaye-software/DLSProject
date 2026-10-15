import { randomUUID } from "node:crypto";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel } from "amqplib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FakePaymentProvider } from "../../src/adapters/fake-payment-provider.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { startConsumer } from "../../src/adapters/rabbitmq/consumer.js";
import { createOrderEventHandlers } from "../../src/adapters/rabbitmq/order-events.js";
import { assertConsumerTopology } from "../../src/adapters/rabbitmq/topology.js";
import { startRabbitMq } from "../support/rabbitmq.js";

const ORDER_EVENTS = "order.events";
const QUEUE = "payment.order.events";
const BROKER_WAIT = { timeout: 10_000 };

let container: StartedRabbitMQContainer;
let publisherConnection: ChannelModel;
let publisher: Channel;
let broker: BrokerConnection;
const payments = new FakePaymentProvider();

beforeAll(async () => {
  container = await startRabbitMq();
  publisherConnection = await connect(container.getAmqpUrl());
  publisher = await publisherConnection.createChannel();
});

beforeEach(async () => {
  broker = await connectToBroker(container.getAmqpUrl());
  const handlers = createOrderEventHandlers({ payments });
  await assertConsumerTopology(broker.channel, { exchange: ORDER_EVENTS, queue: QUEUE, routingKeys: Object.keys(handlers) });
  await startConsumer(broker.channel, { queue: QUEUE, handlers, retryDelaysMs: [5] });
});

afterEach(async () => {
  await broker.close().catch(() => undefined);
});

afterAll(async () => {
  await publisherConnection?.close().catch(() => undefined);
  await container?.stop();
});

async function openIntentFor(): Promise<string> {
  const orderId = randomUUID();
  await payments.createIntent({ orderId, userId: randomUUID(), amount: { amount_minor: 11530000, currency: "DKK" } });
  return orderId;
}

function publish(type: string, data: Record<string, unknown>) {
  const event = { specversion: "1.0", id: randomUUID(), source: "/services/orders", type, time: "2026-10-14T10:30:00Z", data };
  publisher.publish(ORDER_EVENTS, type, Buffer.from(JSON.stringify(event)), { persistent: true });
}

async function messageCount(queue: string): Promise<number> {
  return (await publisher.checkQueue(queue)).messageCount;
}

describe("Payment's order.events consumer", () => {
  it.each([
    {
      type: "order_cancelled",
      data: (orderId: string) => ({ order_id: orderId, user_id: randomUUID(), previous_status: "RESERVED", reason: "customer_request", items: [{ product_id: randomUUID(), quantity: 1 }], was_paid: false, cancelled_at: "2026-10-14T10:10:00Z" }),
    },
    {
      type: "order_expired",
      data: (orderId: string) => ({ order_id: orderId, user_id: randomUUID(), items: [{ product_id: randomUUID(), quantity: 1 }], reserved_at: "2026-10-14T10:00:00Z", expired_at: "2026-10-14T10:30:00Z" }),
    },
  ])("cancels the order's PaymentIntent on $type and acks the event", async ({ type, data }) => {
    const orderId = await openIntentFor();

    publish(type, data(orderId));

    await vi.waitFor(() => expect(payments.intents.get(orderId)?.status).toBe("canceled"), BROKER_WAIT);
    await broker.close();
    expect(await messageCount(QUEUE)).toBe(0);
    expect(await messageCount(`${QUEUE}.dlq`)).toBe(0);
  });
});
