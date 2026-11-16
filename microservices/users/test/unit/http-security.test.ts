import { describe, expect, it } from "vitest";
import { serve } from "../support/serve.js";

const EXPECTED_HEADERS = {
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; form-action 'none'",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

describe("HTTP security defaults", () => {
  it.each(["/health", "/no-such-route"])("sets the security headers on %s", async (path) => {
    const response = await fetch(`${await serve()}${path}`);

    for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
      expect(response.headers.get(name), name).toBe(value);
    }
    expect(response.headers.get("permissions-policy")).toMatch(/camera=\(\)/);
  });

  it("answers an unknown route with 404 problem+json instead of an HTML page", async () => {
    const response = await fetch(`${await serve()}/no-such-route`);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toEqual({
      type: "https://limitedwatches.dk/problems/not_found",
      title: "Not found",
      status: 404,
      detail: "No route for GET /no-such-route.",
      instance: "/no-such-route",
    });
  });
});
