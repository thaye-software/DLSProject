import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, isDatabaseReachable, type Database } from "../../src/adapters/db/prisma.js";
import type { BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { connectToBroker } from "../../src/adapters/rabbitmq/connection.js";
import { serve } from "../support/serve.js";
import { startRabbitMq } from "../support/rabbitmq.js";

let postgres: StartedPostgreSqlContainer;
let rabbit: StartedRabbitMQContainer;
let database: Database;
let broker: BrokerConnection;

beforeAll(async () => {
  [postgres, rabbit] = await Promise.all([new PostgreSqlContainer("postgres:17-alpine").start(), startRabbitMq()]);
  database = createDatabase(postgres.getConnectionUri());
  broker = await connectToBroker(rabbit.getAmqpUrl());
});

afterAll(async () => {
  await broker?.close();
  await database?.$disconnect();
  await Promise.all([postgres?.stop(), rabbit?.stop()]);
});

describe("GET /health against Postgres and RabbitMQ", () => {
  it("answers 200 when both are reachable", async () => {
    const baseUrl = await serve({
      isBrokerConnected: broker.isOpen,
      isDatabaseReachable: () => isDatabaseReachable(database),
    });

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 database_unavailable when Postgres is not reachable", async () => {
    const down = createDatabase("postgresql://catalog:catalog@127.0.0.1:1/catalog");
    try {
      const baseUrl = await serve({
        isBrokerConnected: broker.isOpen,
        isDatabaseReachable: () => isDatabaseReachable(down),
      });

      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(503);
      expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
      expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/database_unavailable");
    } finally {
      await down.$disconnect();
    }
  });

  it("answers 503 broker_unavailable when the broker connection is closed", async () => {
    const closed = await connectToBroker(rabbit.getAmqpUrl());
    await closed.close();
    const baseUrl = await serve({
      isBrokerConnected: closed.isOpen,
      isDatabaseReachable: () => isDatabaseReachable(database),
    });

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/broker_unavailable");
  });
});
