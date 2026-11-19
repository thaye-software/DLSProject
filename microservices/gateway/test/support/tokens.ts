import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";

const DEFAULT_ISSUER = "https://x.supabase.co/auth/v1";
const DEFAULT_AUDIENCE = "authenticated";

export async function createTestKeys(): Promise<{
  jwks: JWTVerifyGetKey;
  sign(
    claims: Record<string, unknown>,
    options?: { expiresIn?: string; issuer?: string; audience?: string },
  ): Promise<string>;
}> {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), alg: "ES256", kid: "test-key" };
  return {
    jwks: createLocalJWKSet({ keys: [jwk] }),
    sign: (claims, options = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: "ES256", kid: "test-key" })
        .setIssuedAt()
        .setIssuer(options.issuer ?? DEFAULT_ISSUER)
        .setAudience(options.audience ?? DEFAULT_AUDIENCE)
        .setExpirationTime(options.expiresIn ?? "5m")
        .sign(privateKey),
  };
}

export function signHs256(secret: string, claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(DEFAULT_ISSUER)
    .setAudience(DEFAULT_AUDIENCE)
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}
