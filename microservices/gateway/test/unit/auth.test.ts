import { beforeAll, describe, expect, it } from "vitest";
import { InvalidTokenError, createTokenVerifier } from "../../src/auth.js";
import { createTestKeys, signHs256 } from "../support/tokens.js";

const SUPABASE_URL = "https://x.supabase.co";
const USER_ID = "7b0f3a52-5d57-4c1e-9d0b-0f5c1f2a9e11";
const SECRET = "s".repeat(40);
const b64url = (s: string) => Buffer.from(s).toString("base64url");

let keys: Awaited<ReturnType<typeof createTestKeys>>;
beforeAll(async () => {
  keys = await createTestKeys();
});

const verifier = (jwtSecret: string | null = null) =>
  createTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret, jwks: keys.jwks });
const claims = (extra: Record<string, unknown> = {}) => ({ sub: USER_ID, email: "a@b.dk", app_metadata: {}, ...extra });

describe("createTokenVerifier", () => {
  it("accepts a valid ES256 token", async () => {
    await expect(verifier()(await keys.sign(claims()))).resolves.toEqual({
      userId: USER_ID,
      email: "a@b.dk",
      role: "customer",
    });
  });

  it("admin from app_metadata", async () => {
    const id = await verifier()(await keys.sign(claims({ app_metadata: { role: "admin" } })));
    expect(id.role).toBe("admin");
  });

  it("ignores user_metadata.role", async () => {
    const id = await verifier()(await keys.sign(claims({ user_metadata: { role: "admin" } })));
    expect(id.role).toBe("customer");
  });

  it("rejects expired", async () => {
    await expect(verifier()(await keys.sign(claims(), { expiresIn: "-1m" }))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects wrong issuer", async () => {
    await expect(verifier()(await keys.sign(claims(), { issuer: "https://evil/auth/v1" }))).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("accepts the configured issuer when it differs from the fetch URL", async () => {
    const verify = createTokenVerifier({
      supabaseUrl: "http://host.docker.internal:55421",
      issuer: "http://127.0.0.1:55421/auth/v1",
      jwtSecret: null,
      jwks: keys.jwks,
    });
    const token = await keys.sign(claims(), { issuer: "http://127.0.0.1:55421/auth/v1" });
    await expect(verify(token)).resolves.toMatchObject({ userId: USER_ID });
  });

  it("with an issuer configured, rejects a token issued by the fetch URL", async () => {
    const verify = createTokenVerifier({
      supabaseUrl: "http://host.docker.internal:55421",
      issuer: "http://127.0.0.1:55421/auth/v1",
      jwtSecret: null,
      jwks: keys.jwks,
    });
    const token = await keys.sign(claims(), { issuer: "http://host.docker.internal:55421/auth/v1" });
    await expect(verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects wrong audience", async () => {
    await expect(verifier()(await keys.sign(claims(), { audience: "other" }))).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("rejects HS256 when no secret configured", async () => {
    await expect(verifier(null)(await signHs256(SECRET, claims()))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("accepts HS256 when secret configured", async () => {
    await expect(verifier(SECRET)(await signHs256(SECRET, claims()))).resolves.toMatchObject({ userId: USER_ID });
  });

  it("rejects an ES256 token signed with a different key", async () => {
    const other = await createTestKeys();
    await expect(verifier()(await other.sign(claims()))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects HS256 signed with a different secret than configured", async () => {
    await expect(verifier(SECRET)(await signHs256("x".repeat(40), claims()))).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("rejects alg none", async () => {
    const token = `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(claims()))}.`;
    await expect(verifier()(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects garbage", async () => {
    await expect(verifier()("not-a-jwt")).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(verifier()("")).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects missing email", async () => {
    await expect(verifier()(await keys.sign({ sub: USER_ID }))).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
