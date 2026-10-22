import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { startRabbitMq } from "../support/rabbitmq.js";

let container: StartedRabbitMQContainer;
let connection: BrokerConnection | undefined;

beforeEach(async () => {
  container = await startRabbitMq();
});

afterEach(async () => {
  await connection?.close().catch(() => undefined);
  connection = undefined;
  await container.stop().catch(() => undefined);
});

describe("connectToBroker", () => {
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
    connection = undefined;
  });
});
