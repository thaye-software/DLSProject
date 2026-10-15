import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/adapters/http/app.js";

let server: Server | undefined;

async function getHealth(isBrokerConnected: boolean): Promise<Response> {
  const app = createApp({ isBrokerConnected: () => isBrokerConnected });
  server = app.listen(0);
  await new Promise((resolve) => server!.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}/health`);
}

afterEach(async () => {
  const running = server;
  server = undefined;
  if (running) await new Promise((resolve) => running.close(resolve));
});

describe("GET /health", () => {
  it("answers 200 when the broker channel is open", async () => {
    const response = await getHealth(true);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 problem+json when the broker channel is closed", async () => {
    const response = await getHealth(false);

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toEqual({
      type: "https://limitedwatches.dk/problems/broker_unavailable",
      title: "Message broker unavailable",
      status: 503,
      detail: "The RabbitMQ channel is closed.",
      instance: "/health",
    });
  });
});
