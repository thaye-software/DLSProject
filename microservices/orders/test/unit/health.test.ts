import { describe, expect, it } from "vitest";
import { serve } from "../support/serve.js";

async function getHealth(broker: boolean, database: boolean): Promise<Response> {
  const baseUrl = await serve({ isBrokerConnected: () => broker, isDatabaseReachable: async () => database });
  return fetch(`${baseUrl}/health`);
}

describe("GET /health", () => {
  it("answers 200 when the broker and the database are up", async () => {
    const response = await getHealth(true, true);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it.each([
    { name: "broker down", broker: false, database: true, code: "broker_unavailable" },
    { name: "database down", broker: true, database: false, code: "database_unavailable" },
    { name: "both down reports the broker", broker: false, database: false, code: "broker_unavailable" },
  ])("answers 503 problem+json when $name", async ({ broker, database, code }) => {
    const response = await getHealth(broker, database);

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect((await response.json()).type).toBe(`https://limitedwatches.dk/problems/${code}`);
  });
});
