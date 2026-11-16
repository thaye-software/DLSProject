import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier } from "../../src/auth.js";
import { createApp } from "../../src/app.js";
import type { Config } from "../../src/config.js";
import { createTestKeys } from "../support/tokens.js";
import { startUpstream } from "../support/upstream.js";

const USER_ID = "7b0f3a52-5d57-4c1e-9d0b-0f5c1f2a9e11";
const ORIGIN = "https://shop.example";
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

let keys: Awaited<ReturnType<typeof createTestKeys>>;
let upstream: Awaited<ReturnType<typeof startUpstream>>;
let base: string;
let downBase: string;
const servers: Server[] = [];

async function listen(config: Config): Promise<string> {
  const verifyToken = createTokenVerifier({ supabaseUrl: "https://x.supabase.co", jwtSecret: null, jwks: keys.jwks });
  const s = createApp({ config, verifyToken }).listen(0, "127.0.0.1");
  await new Promise((resolve) => s.once("listening", resolve));
  servers.push(s);
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

const baseConfig = (upstreams: Config["upstreams"]): Config => ({
  port: 0,
  supabaseUrl: "https://x.supabase.co",
  supabaseJwtIssuer: "https://x.supabase.co/auth/v1",
  supabaseJwtSecret: null,
  upstreams,
  corsOrigins: [ORIGIN],
  upstreamTimeoutMs: 5000,
});

beforeAll(async () => {
  keys = await createTestKeys();
  upstream = await startUpstream();
  const u = upstream.url;
  base = await listen(baseConfig({ orders: u, payment: u, catalog: u, search: u, messaging: u, notif: u }));
  downBase = await listen(baseConfig({ search: "http://127.0.0.1:1" }));
});

afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  await upstream.close();
});

const token = (extra: Record<string, unknown> = {}, opts?: { expiresIn?: string }) =>
  keys.sign({ sub: USER_ID, email: "a@b.dk", app_metadata: {}, ...extra }, opts);
const bearer = async (extra?: Record<string, unknown>) => ({ authorization: `Bearer ${await token(extra)}` });

describe("gateway app", () => {
  it("strips forged identity headers on a public route", async () => {
    const res = await fetch(`${base}/contact`, {
      method: "POST",
      headers: { "x-user-id": "evil", "x-user-role": "admin", "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const seen = upstream.lastRequest()!.headers;
    expect(seen["x-user-id"]).toBeUndefined();
    expect(seen["x-user-role"]).toBeUndefined();
  });

  it("sets identity headers from the token", async () => {
    const res = await fetch(`${base}/orders`, { headers: await bearer() });
    expect(res.status).toBe(200);
    const seen = upstream.lastRequest()!.headers;
    expect(seen["x-user-id"]).toBe(USER_ID);
    expect(seen["x-user-email"]).toBe("a@b.dk");
    expect(seen["x-user-role"]).toBe("customer");
  });

  it("admin token sets admin role", async () => {
    await fetch(`${base}/orders`, { headers: await bearer({ app_metadata: { role: "admin" } }) });
    expect(upstream.lastRequest()!.headers["x-user-role"]).toBe("admin");
  });

  it("required route without token", async () => {
    const before = upstream.lastRequest();
    const res = await fetch(`${base}/orders`);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(((await res.json()) as { type: string }).type).toMatch(/\/unauthorized$/);
    expect(upstream.lastRequest()).toBe(before);
  });

  it('required route with "Bearer " and no token', async () => {
    const res = await fetch(`${base}/orders`, { headers: { authorization: "Bearer " } });
    expect(res.status).toBe(401);
  });

  it("optional route without token", async () => {
    const res = await fetch(`${base}/products`);
    expect(res.status).toBe(200);
    const seen = upstream.lastRequest()!.headers;
    expect(seen["x-user-id"]).toBeUndefined();
    expect(seen["x-user-email"]).toBeUndefined();
    expect(seen["x-user-role"]).toBeUndefined();
  });

  it("optional route with expired token", async () => {
    const expired = await token({}, { expiresIn: "-1m" });
    const res = await fetch(`${base}/products`, { headers: { authorization: `Bearer ${expired}` } });
    expect(res.status).toBe(401);
  });

  it.each([
    "/internal/reservations",
    "/Internal/reservations",
    "//internal/x",
    "/orders/..%2Finternal/reservations",
    "/orders/%E0%A4%A",
  ])("internal path %s 404s", async (path) => {
    await fetch(`${base}/products`); // marker request
    const before = upstream.lastRequest();
    const res = await fetch(`${base}${path}`, { headers: await bearer() });
    expect(res.status).toBe(404);
    expect(upstream.lastRequest()).toBe(before);
  });

  it("unconfigured upstream", async () => {
    const res = await fetch(`${base}/webhooks/supabase/email-confirmed`, { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
  });

  it("forwards raw body untouched", async () => {
    const body = '{"a":1,  "b":"ø"}';
    await fetch(`${base}/webhooks/stripe`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=x" },
      body,
    });
    const seen = upstream.lastRequest()!;
    expect(seen.body.equals(Buffer.from(body))).toBe(true);
    expect(seen.headers["stripe-signature"]).toBe("t=1,v1=x");
  });

  it("forwards encoded and repeated query params", async () => {
    await fetch(`${base}/search?q=rolex%20sub&brand=omega&page=2`);
    expect(upstream.lastRequest()!.url).toBe("/search?q=rolex%20sub&brand=omega&page=2");
  });

  it("keeps a valid traceparent", async () => {
    const tp = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
    await fetch(`${base}/search`, { headers: { traceparent: tp } });
    expect(upstream.lastRequest()!.headers.traceparent).toBe(tp);
  });

  it("generates traceparent when missing or invalid", async () => {
    await fetch(`${base}/search`);
    expect(upstream.lastRequest()!.headers.traceparent).toMatch(TRACEPARENT);
    await fetch(`${base}/search`, { headers: { traceparent: "garbage" } });
    expect(upstream.lastRequest()!.headers.traceparent).toMatch(TRACEPARENT);
  });

  it("upstream down answers 502 quickly", async () => {
    const started = Date.now();
    const res = await fetch(`${downBase}/search`);
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("CORS preflight", async () => {
    const ok = await fetch(`${base}/orders`, { method: "OPTIONS", headers: { origin: ORIGIN } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const bad = await fetch(`${base}/orders`, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("GET /health", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
