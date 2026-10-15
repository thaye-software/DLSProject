import { describe, expect, it } from "vitest";
import { serve } from "../support/serve.js";

async function getHealth(isBrokerConnected: boolean): Promise<Response> {
  const baseUrl = await serve({ isBrokerConnected: () => isBrokerConnected });
  return fetch(`${baseUrl}/health`);
}

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
