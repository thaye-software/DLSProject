import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";

let container: StartedRabbitMQContainer;
let connection: BrokerConnection | undefined;

beforeEach(async () => {
  container = await new RabbitMQContainer("rabbitmq:4-alpine").start();
});

afterEach(async () => {
  await connection?.close().catch(() => undefined);
  connection = undefined;
  await container.stop().catch(() => undefined);
});

describe("connectToBroker", () => {
  it("reports open once connected", async () => {
    connection = await connectToBroker(container.getAmqpUrl());

    expect(connection.isOpen()).toBe(true);
  });

  it("reports closed and notifies when the broker goes away", async () => {
    connection = await connectToBroker(container.getAmqpUrl());
    const onUnexpectedClose = vi.fn();
    connection.onUnexpectedClose(onUnexpectedClose);

    await container.stop();

    await vi.waitFor(() => expect(onUnexpectedClose).toHaveBeenCalledOnce(), { timeout: 15_000 });
    expect(connection.isOpen()).toBe(false);
  });

  it("reports closed without notifying after a deliberate close", async () => {
    connection = await connectToBroker(container.getAmqpUrl());
    const onUnexpectedClose = vi.fn();
    connection.onUnexpectedClose(onUnexpectedClose);

    await connection.close();

    expect(connection.isOpen()).toBe(false);
    expect(onUnexpectedClose).not.toHaveBeenCalled();
  });

  // Found by the order confirmation integration test (Notif issue 04): an email was sent, yet its event was redelivered.
  it("regression: an ack sent right before a deliberate close is lost", async () => {
    connection = await connectToBroker(container.getAmqpUrl());
    const queue = "regression.ack-before-close";
    await connection.channel.assertQueue(queue, { durable: true, arguments: { "x-queue-type": "quorum" } });
    connection.channel.sendToQueue(queue, Buffer.from("event"), { persistent: true });
    await vi.waitFor(async () => expect((await connection!.channel.checkQueue(queue)).messageCount).toBe(1));

    const message = await connection.channel.get(queue, { noAck: false });
    connection.channel.ack(message as Exclude<typeof message, false>);
    await connection.close();

    const inspector = await connectToBroker(container.getAmqpUrl());
    const { messageCount } = await inspector.channel.checkQueue(queue);
    await inspector.close();
    expect(messageCount).toBe(0);
  });

  it("rejects when no broker is listening", async () => {
    const url = container.getAmqpUrl();
    await container.stop();

    await expect(connectToBroker(url)).rejects.toThrow();
  });
});
