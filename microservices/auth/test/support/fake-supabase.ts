import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";

export const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
export const USER_EMAIL = "mette@example.com";
export const LEGACY_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters";

export type SignOptions = {
  // Claims to add or replace; undefined removes one.
  claims?: Record<string, unknown>;
  expiresInS?: number;
  kid?: string;
  // Signs with a key the JWKS does not publish.
  foreignKey?: boolean;
};

export type FakeSupabase = {
  url: string;
  // An access token like Supabase Auth issues to a signed-in user, signed with the published ES256 key.
  sign(options?: SignOptions): Promise<string>;
  // The same, signed the legacy way with the project's shared HS256 secret.
  signHs256(options?: SignOptions, secret?: string): Promise<string>;
  // From now on the JWKS endpoint answers this status.
  setJwksStatus(status: number): void;
  jwksRequests(): number;
  close(): Promise<void>;
};

// Supabase's JWKS endpoint (<url>/auth/v1/.well-known/jwks.json) on a local port, plus a token minter.
export async function startFakeSupabase(): Promise<FakeSupabase> {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const { privateKey: foreignKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "key-1", alg: "ES256", use: "sig" };
  let jwksStatus = 200;
  let jwksRequests = 0;

  const server = createServer((request, response) => {
    if (request.url !== "/auth/v1/.well-known/jwks.json") {
      response.writeHead(404).end();
      return;
    }
    jwksRequests += 1;
    response.writeHead(jwksStatus, { "content-type": "application/json" });
    response.end(jwksStatus === 200 ? JSON.stringify({ keys: [jwk] }) : "{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const build = (options: SignOptions, header: { alg: string; kid?: string }, key: CryptoKey | Uint8Array) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: `${url}/auth/v1`,
      aud: "authenticated",
      sub: USER_ID,
      email: USER_EMAIL,
      role: "authenticated",
      iat: now,
      exp: now + (options.expiresInS ?? 3600),
      ...options.claims,
    };
    return new SignJWT(payload).setProtectedHeader({ ...header, typ: "JWT" }).sign(key);
  };

  return {
    url,
    sign: (options = {}) => build(options, { alg: "ES256", kid: options.kid ?? "key-1" }, options.foreignKey ? foreignKey : privateKey),
    signHs256: (options = {}, secret = LEGACY_JWT_SECRET) => build(options, { alg: "HS256" }, new TextEncoder().encode(secret)),
    setJwksStatus: (status) => {
      jwksStatus = status;
    },
    jwksRequests: () => jwksRequests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
