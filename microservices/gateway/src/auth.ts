import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

export type Identity = { userId: string; email: string; role: "admin" | "customer" };
export type VerifyToken = (token: string) => Promise<Identity>;

export class InvalidTokenError extends Error {}

const AUDIENCE = "authenticated";

const claimsSchema = z.object({
  sub: z.uuid(),
  email: z.string().min(1),
  app_metadata: z.object({ role: z.unknown().optional() }).optional(),
});

export function createTokenVerifier(options: {
  supabaseUrl: string;
  jwtSecret: string | null;
  jwks?: JWTVerifyGetKey;
}): VerifyToken {
  const issuer = `${options.supabaseUrl}/auth/v1`;
  const jwks = options.jwks ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const secret = options.jwtSecret === null ? null : new TextEncoder().encode(options.jwtSecret);

  return async (token) => {
    try {
      const { alg } = decodeProtectedHeader(token);
      const verifyOptions = { issuer, audience: AUDIENCE };
      let payload;
      if (alg === "HS256") {
        if (secret === null) throw new Error("HS256 not enabled");
        ({ payload } = await jwtVerify(token, secret, { ...verifyOptions, algorithms: ["HS256"] }));
      } else {
        ({ payload } = await jwtVerify(token, jwks, { ...verifyOptions, algorithms: ["ES256", "RS256"] }));
      }
      const claims = claimsSchema.parse(payload);
      // Role comes only from app_metadata (server-controlled); user_metadata is user-editable.
      const role = claims.app_metadata?.role === "admin" ? "admin" : "customer";
      return { userId: claims.sub, email: claims.email, role };
    } catch (cause) {
      throw new InvalidTokenError("Invalid token", { cause });
    }
  };
}
