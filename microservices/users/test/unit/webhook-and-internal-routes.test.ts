import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { aUser, USER_ID } from "../fixtures/users.js";
import { contractSchema, openApi } from "../support/contract.js";
import { INTERNAL_JWT_SECRET, serve, WEBHOOK_SECRET } from "../support/serve.js";

function webhook(record: Record<string, unknown>, oldRecord: Record<string, unknown>) {
  return { type: "UPDATE", table: "users", schema: "auth", record, old_record: oldRecord };
}

const confirmedChange = webhook(
  { id: USER_ID, email: "mette.new@example.com", aud: "authenticated" },
  { id: USER_ID, email: "mette@example.com", aud: "authenticated" },
);

describe("POST /webhooks/supabase/email-confirmed", () => {
  // null sends no secret header at all.
  const post = (baseUrl: string, body: unknown, secret: string | null = WEBHOOK_SECRET) =>
    fetch(`${baseUrl}/webhooks/supabase/email-confirmed`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret === null ? {} : { "x-supabasewebhook-secret": secret }) },
      body: JSON.stringify(body),
    });

  it("syncs the new email from record and old_record", async () => {
    const syncConfirmedEmail = vi.fn(async () => "updated" as const);
    const baseUrl = await serve({ syncConfirmedEmail });

    const response = await post(baseUrl, confirmedChange);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "updated" });
    expect(syncConfirmedEmail).toHaveBeenCalledWith({ userId: USER_ID, oldEmail: "mette@example.com", newEmail: "mette.new@example.com" });
  });

  it.each([
    { name: "a wrong secret", secret: "x".repeat(32) },
    { name: "no secret", secret: null },
  ])("answers 401 for $name, before reading the body", async ({ secret }) => {
    const syncConfirmedEmail = vi.fn();
    const baseUrl = await serve({ syncConfirmedEmail });

    const response = await post(baseUrl, confirmedChange, secret);

    expect(response.status).toBe(401);
    expect((await response.json()).type).toBe("https://limitedwatches.dk/problems/unauthorized");
    expect(syncConfirmedEmail).not.toHaveBeenCalled();
  });

  it.each([
    { name: "an INSERT", body: { ...confirmedChange, type: "INSERT" } },
    { name: "another table", body: { ...confirmedChange, table: "profiles" } },
    { name: "a record without id", body: webhook({ email: "a@example.com" }, {}) },
  ])("answers 422 for $name", async ({ body }) => {
    const baseUrl = await serve();

    const response = await post(baseUrl, body);

    expect(response.status).toBe(422);
  });

  it("answers 404 for an unknown user and 409 for an email another user has", async () => {
    const results = ["not_found", "email_taken"] as const;
    let call = 0;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const baseUrl = await serve({ syncConfirmedEmail: async () => results[call++]! });

    expect((await post(baseUrl, confirmedChange)).status).toBe(404);
    expect((await post(baseUrl, confirmedChange)).status).toBe(409);
  });

  it("matches the contract's request schema", () => {
    const validate = contractSchema("SupabaseUpdateWebhook");

    expect(validate(confirmedChange), JSON.stringify(validate.errors)).toBe(true);
    expect(openApi.paths["/webhooks/supabase/email-confirmed"].post.security).toEqual([{ supabaseWebhookSecret: [] }]);
  });
});

describe("GET /internal/users/{user_id}", () => {
  async function serviceJwt({ issuer = "auth", audience = "users", lifetimeS = 60 } = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + lifetimeS)
      .sign(new TextEncoder().encode(INTERNAL_JWT_SECRET));
  }

  const get = async (baseUrl: string, token: string, userId = USER_ID) =>
    fetch(`${baseUrl}/internal/users/${userId}`, { headers: { authorization: `Bearer ${token}` } });

  it("answers role and deleted state to Auth", async () => {
    const baseUrl = await serve({ getUser: async () => aUser({ role: "admin" }) });

    const response = await get(baseUrl, await serviceJwt());

    expect(response.status).toBe(200);
    const body = await response.json();
    const validate = contractSchema("InternalUser");
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body).toEqual({ user_id: USER_ID, role: "admin", deleted: false });
  });

  it("reports a deleted user as deleted", async () => {
    const baseUrl = await serve({ getUser: async () => aUser({ deletedAt: new Date("2026-10-14T12:00:00Z") }) });

    expect((await (await get(baseUrl, await serviceJwt())).json()).deleted).toBe(true);
  });

  it.each([
    { name: "another issuer", token: () => serviceJwt({ issuer: "gateway" }) },
    { name: "another audience", token: () => serviceJwt({ audience: "orders" }) },
    { name: "a token living longer than 60 s", token: () => serviceJwt({ lifetimeS: 3600 }) },
    { name: "no token", token: async () => "" },
  ])("answers 401 for $name", async ({ token }) => {
    const getUser = vi.fn();
    const baseUrl = await serve({ getUser });

    const response = await get(baseUrl, await token());

    expect(response.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown or malformed id", async () => {
    const baseUrl = await serve();
    const token = await serviceJwt();

    expect((await get(baseUrl, token)).status).toBe(404);
    expect((await get(baseUrl, token, "not-a-uuid")).status).toBe(404);
  });
});
