import { createRemoteJWKSet, decodeProtectedHeader, errors, jwtVerify, type JWTPayload, type JWTVerifyOptions } from "jose";
import { z } from "zod";
import type { TokenCheck, TokenVerifier } from "../application/ports/token-verifier.js";

export type SupabaseTokenVerifierOptions = {
  // The project URL, e.g. https://xyz.supabase.co. Tokens are issued by <url>/auth/v1.
  supabaseUrl: string;
  // Only for projects still on the legacy shared JWT secret (HS256). Without it, HS256 tokens are rejected.
  jwtSecret?: string;
};

// Containers on different hosts can disagree on the time by a few seconds.
const CLOCK_TOLERANCE_S = 5;
// Supabase's asymmetric signing keys are ES256 (default) or RS256.
const ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"];
const JWKS_TIMEOUT_MS = 3000;

// Supabase access tokens of signed-in users. The anon and service_role keys are JWTs from the same project too,
// so role must be checked: they would otherwise pass as users.
const claimsSchema = z.object({
  sub: z.uuid({ message: "sub is not a user id" }),
  email: z.email({ message: "token has no email" }),
  role: z.literal("authenticated", { message: "not a signed-in user's token" }),
});

// The token is at fault, so the answer is 401; anything else (e.g. the JWKS cannot be fetched) is 503.
const INVALID_TOKEN_ERRORS = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
];

export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly secret: Uint8Array | undefined;

  constructor({ supabaseUrl, jwtSecret }: SupabaseTokenVerifierOptions) {
    const base = supabaseUrl.replace(/\/+$/, "");
    this.issuer = `${base}/auth/v1`;
    // jose caches the keys and refetches (with a cooldown) when a token names a key id it does not know,
    // so Supabase's key rotation needs nothing here.
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), { timeoutDuration: JWKS_TIMEOUT_MS });
    this.secret = jwtSecret ? new TextEncoder().encode(jwtSecret) : undefined;
  }

  async verify(token: string): Promise<TokenCheck> {
    let algorithm: string | undefined;
    try {
      algorithm = decodeProtectedHeader(token).alg;
    } catch {
      return { kind: "invalid", reason: "malformed token" };
    }

    const options: JWTVerifyOptions = {
      issuer: this.issuer,
      audience: "authenticated",
      requiredClaims: ["exp", "sub"],
      clockTolerance: CLOCK_TOLERANCE_S,
    };

    let payload: JWTPayload;
    try {
      if (algorithm === "HS256") {
        if (!this.secret) return { kind: "invalid", reason: "HS256 tokens are not accepted" };
        ({ payload } = await jwtVerify(token, this.secret, { ...options, algorithms: ["HS256"] }));
      } else {
        ({ payload } = await jwtVerify(token, this.jwks, { ...options, algorithms: ASYMMETRIC_ALGORITHMS }));
      }
    } catch (error) {
      if (INVALID_TOKEN_ERRORS.some((type) => error instanceof type)) return { kind: "invalid", reason: describe(error) };
      console.error("Could not verify a token: Supabase's signing keys are unavailable", error);
      return { kind: "unavailable" };
    }

    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) return { kind: "invalid", reason: claims.error.issues[0]!.message };
    return { kind: "valid", token: { userId: claims.data.sub, email: claims.data.email } };
  }
}

function describe(error: unknown): string {
  if (error instanceof errors.JWTExpired) return "token expired";
  if (error instanceof errors.JWTClaimValidationFailed) return `${error.claim} claim ${error.reason === "check_failed" ? "is not accepted" : error.reason}`;
  if (error instanceof errors.JWKSNoMatchingKey) return "signed with an unknown key";
  if (error instanceof errors.JOSEAlgNotAllowed) return "signing algorithm not accepted";
  return "invalid token";
}
