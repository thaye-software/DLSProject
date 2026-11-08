import { describe, expect, it, vi } from "vitest";
import type { VerifyResult } from "../../src/application/verify-request.js";
import { contractSchema } from "../support/contract.js";
import { serve } from "../support/serve.js";

const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
const forwarded = { authorization: "Bearer abc.def.ghi", "x-forwarded-method": "GET", "x-forwarded-uri": "/orders?page=2" };

describe("/verify", () => {
  it("answers 200 with the user headers and an empty body", async () => {
    const verifyRequest = vi.fn(async (): Promise<VerifyResult> => ({ kind: "allowed", userId: USER_ID, email: "mette@example.com", role: "admin" }));
    const baseUrl = await serve({ verifyRequest });

    const response = await fetch(`${baseUrl}/verify`, { headers: forwarded });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-user-id")).toBe(USER_ID);
    expect(response.headers.get("x-user-email")).toBe("mette@example.com");
    expect(response.headers.get("x-user-role")).toBe("admin");
    expect(await response.text()).toBe("");
    expect(verifyRequest).toHaveBeenCalledWith({ authorization: "Bearer abc.def.ghi", method: "GET", uri: "/orders?page=2" });
  });

  it("accepts the client's method too (nginx auth_request)", async () => {
    const baseUrl = await serve({ verifyRequest: async () => ({ kind: "allowed", userId: USER_ID, email: "m@example.com", role: "customer" }) });

    expect((await fetch(`${baseUrl}/verify`, { method: "POST", headers: forwarded })).status).toBe(200);
  });

  it.each([
    { result: { kind: "unauthorized", detail: "token expired" }, status: 401, code: "unauthorized" },
    { result: { kind: "account_deleted" }, status: 401, code: "account_deleted" },
    { result: { kind: "profile_required" }, status: 403, code: "profile_required" },
    { result: { kind: "signing_keys_unavailable" }, status: 503, code: "signing_keys_unavailable" },
    { result: { kind: "users_unavailable" }, status: 503, code: "users_unavailable" },
  ] as const)("answers $status $code as problem+json naming the client's path", async ({ result, status, code }) => {
    const baseUrl = await serve({ verifyRequest: async () => result });

    const response = await fetch(`${baseUrl}/verify`, { headers: forwarded });

    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(response.headers.get("x-user-id")).toBeNull();
    const body = await response.json();
    const validate = contractSchema("Problem");
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body).toMatchObject({ type: `https://limitedwatches.dk/problems/${code}`, status, instance: "/orders" });
    expect(response.headers.get("www-authenticate")).toBe(status === 401 ? `Bearer error="invalid_token"` : null);
  });

  it("says why the token was refused", async () => {
    const baseUrl = await serve({ verifyRequest: async () => ({ kind: "unauthorized", detail: "token expired" }) });

    const body = await (await fetch(`${baseUrl}/verify`, { headers: forwarded })).json();

    expect(body.detail).toBe("A valid Supabase access token is required: token expired.");
  });

  it("falls back to /verify as instance without X-Forwarded-Uri", async () => {
    const baseUrl = await serve();

    expect((await (await fetch(`${baseUrl}/verify`)).json()).instance).toBe("/verify");
  });

  it("answers 500 problem+json when verification throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const baseUrl = await serve({
      verifyRequest: async () => {
        throw new Error("boom");
      },
    });

    const response = await fetch(`${baseUrl}/verify`, { headers: forwarded });

    expect(response.status).toBe(500);
    expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/internal_error");
  });
});

describe("GET /health", () => {
  it("answers 200 without checking Users or Supabase", async () => {
    const verifyRequest = vi.fn();
    const baseUrl = await serve({ verifyRequest });

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(verifyRequest).not.toHaveBeenCalled();
  });
});
