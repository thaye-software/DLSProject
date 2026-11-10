import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SupabaseTokenVerifier } from "../../src/adapters/supabase-token-verifier.js";
import { LEGACY_JWT_SECRET, startFakeSupabase, USER_EMAIL, USER_ID, type FakeSupabase } from "../support/fake-supabase.js";

let supabase: FakeSupabase;

beforeAll(async () => {
  supabase = await startFakeSupabase();
});

afterAll(async () => {
  await supabase?.close();
});

const verifier = (jwtSecret?: string) => new SupabaseTokenVerifier({ supabaseUrl: supabase.url, jwtSecret });

describe("SupabaseTokenVerifier", () => {
  it("accepts a signed-in user's token signed with the project's published key", async () => {
    expect(await verifier().verify(await supabase.sign())).toEqual({ kind: "valid", token: { userId: USER_ID, email: USER_EMAIL } });
  });

  it("accepts a legacy HS256 token when the project's secret is configured", async () => {
    expect((await verifier(LEGACY_JWT_SECRET).verify(await supabase.signHs256())).kind).toBe("valid");
  });

  it("fetches the signing keys once and caches them", async () => {
    const tokens = verifier();
    const before = supabase.jwksRequests();

    await tokens.verify(await supabase.sign());
    await tokens.verify(await supabase.sign());

    expect(supabase.jwksRequests() - before).toBe(1);
  });

  it.each([
    { name: "an expired token", options: { expiresInS: -60 }, reason: "token expired" },
    { name: "another project's token", options: { claims: { iss: "https://other.supabase.co/auth/v1" } }, reason: "iss" },
    { name: "a token for another audience", options: { claims: { aud: "service" } }, reason: "aud" },
    { name: "the anon key", options: { claims: { role: "anon", sub: undefined, email: undefined } }, reason: "sub" },
    { name: "the service_role key used as a user token", options: { claims: { role: "service_role" } }, reason: "not a signed-in user's token" },
    { name: "a sub that is not a user id", options: { claims: { sub: "admin" } }, reason: "sub is not a user id" },
    { name: "a token without email", options: { claims: { email: undefined } }, reason: "token has no email" },
    { name: "a token signed with an unknown key", options: { kid: "key-2" }, reason: "unknown key" },
    { name: "a forged signature", options: { foreignKey: true }, reason: "invalid token" },
  ])("rejects $name", async ({ options, reason }) => {
    const result = await verifier().verify(await supabase.sign(options));

    expect(result).toEqual({ kind: "invalid", reason: expect.stringContaining(reason) });
  });

  it("rejects HS256 tokens when no legacy secret is configured, and ones signed with another secret", async () => {
    expect(await verifier().verify(await supabase.signHs256())).toEqual({ kind: "invalid", reason: "HS256 tokens are not accepted" });
    expect((await verifier(LEGACY_JWT_SECRET).verify(await supabase.signHs256({}, "x".repeat(40)))).kind).toBe("invalid");
  });

  it("rejects something that is not a JWT", async () => {
    expect(await verifier().verify("not-a-jwt")).toEqual({ kind: "invalid", reason: "malformed token" });
  });

  it("reports unavailable, not invalid, when the signing keys cannot be fetched", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.setJwksStatus(500);
    try {
      expect(await verifier().verify(await supabase.sign())).toEqual({ kind: "unavailable" });
    } finally {
      supabase.setJwksStatus(200);
    }
  });

  it("reports unavailable when Supabase does not answer at all", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unreachable = new SupabaseTokenVerifier({ supabaseUrl: "http://127.0.0.1:9" });

    expect(await unreachable.verify(await supabase.sign())).toEqual({ kind: "unavailable" });
  });
});
