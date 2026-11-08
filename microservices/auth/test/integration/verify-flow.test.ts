import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/adapters/http/app.js";
import { SupabaseTokenVerifier } from "../../src/adapters/supabase-token-verifier.js";
import { HttpUsersClient } from "../../src/adapters/users-client.js";
import { CachedUserDirectory } from "../../src/application/cached-user-directory.js";
import { verifyRequest } from "../../src/application/verify-request.js";
import { LEGACY_JWT_SECRET, startFakeSupabase, USER_EMAIL, USER_ID, type FakeSupabase } from "../support/fake-supabase.js";
import { INTERNAL_JWT_SECRET, startStubUsers, type StubUsers } from "../support/stub-users.js";

const NEW_USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

let supabase: FakeSupabase;
let users: StubUsers;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  [supabase, users] = await Promise.all([startFakeSupabase(), startStubUsers()]);
  // Wired as in main.ts, with the cache off so each request sees the stub's current answer.
  const tokens = new SupabaseTokenVerifier({ supabaseUrl: supabase.url, jwtSecret: LEGACY_JWT_SECRET });
  const directory = new CachedUserDirectory(new HttpUsersClient({ baseUrl: users.url, jwtSecret: INTERNAL_JWT_SECRET }), { ttlMs: 0 });
  server = createApp({ verifyRequest: (request) => verifyRequest(request, { tokens, users: directory }) }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await Promise.all([supabase?.close(), users?.close()]);
});

const verify = (token: string, method = "GET", uri = "/orders") =>
  fetch(`${baseUrl}/verify`, { headers: { authorization: `Bearer ${token}`, "x-forwarded-method": method, "x-forwarded-uri": uri } });

describe("gateway → Auth → Supabase JWKS + Users", () => {
  it("lets a signed-in customer through with the headers the services read", async () => {
    users.answer(USER_ID, { status: 200, body: { user_id: USER_ID, role: "customer", deleted: false } });

    const response = await verify(await supabase.sign());

    expect(response.status).toBe(200);
    expect(Object.fromEntries(["x-user-id", "x-user-email", "x-user-role"].map((name) => [name, response.headers.get(name)]))).toEqual({
      "x-user-id": USER_ID,
      "x-user-email": USER_EMAIL,
      "x-user-role": "customer",
    });
  });

  it("accepts the legacy HS256 tokens too", async () => {
    users.answer(USER_ID, { status: 200, body: { user_id: USER_ID, role: "admin", deleted: false } });

    const response = await verify(await supabase.signHs256());

    expect(response.headers.get("x-user-role")).toBe("admin");
  });

  it("walks a new user from signup to their first order", async () => {
    const token = await supabase.sign({ claims: { sub: NEW_USER_ID, email: "lars@example.com" } });

    expect((await verify(token, "GET", "/orders")).status).toBe(403);
    expect((await verify(token, "POST", "/users")).status).toBe(200);
    users.answer(NEW_USER_ID, { status: 200, body: { user_id: NEW_USER_ID, role: "customer", deleted: false } });
    expect((await verify(token, "GET", "/orders")).status).toBe(200);
  });

  it("rejects a deleted account even though its token is still valid", async () => {
    users.answer(USER_ID, { status: 200, body: { user_id: USER_ID, role: "customer", deleted: true } });

    const response = await verify(await supabase.sign());

    expect(response.status).toBe(401);
    expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/account_deleted");
  });

  it("rejects an expired token without asking Users", async () => {
    const callsBefore = users.calls().length;

    const response = await verify(await supabase.sign({ expiresInS: -60 }));

    expect(response.status).toBe(401);
    expect(users.calls()).toHaveLength(callsBefore);
  });

  it("signs every lookup in a way Users accepts", () => {
    expect(users.rejectedTokens()).toBe(0);
  });
});
