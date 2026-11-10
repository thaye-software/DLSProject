import type { RequestHandler } from "express";
import { jwtVerify } from "jose";
import { sendProblem } from "./problem.js";

export type ServiceAuthOptions = {
  secret: string;
  // This service's name, the token's aud.
  audience: string;
  // The services allowed to call, the token's iss.
  issuers: readonly string[];
};

// docs/contracts/README.md §5: callers sign their own HS256 token that lives at most 60 s.
const MAX_LIFETIME_S = 60;
// Containers on different hosts can disagree on the time by a few seconds.
const CLOCK_TOLERANCE_S = 5;

export function requireServiceJwt({ secret, audience, issuers }: ServiceAuthOptions): RequestHandler {
  const key = new TextEncoder().encode(secret);

  return async (request, response, next) => {
    const token = /^Bearer (.+)$/.exec(request.get("authorization") ?? "")?.[1];
    try {
      if (!token) throw new Error("no bearer token");
      const { payload } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
        audience,
        issuer: [...issuers],
        requiredClaims: ["iat", "exp"],
        maxTokenAge: MAX_LIFETIME_S,
        clockTolerance: CLOCK_TOLERANCE_S,
      });
      if (payload.exp! - payload.iat! > MAX_LIFETIME_S) throw new Error("token lives longer than 60 s");
    } catch (error) {
      sendProblem(response, {
        code: "unauthorized",
        title: "Missing or invalid service token",
        status: 401,
        detail: `A valid service JWT is required: ${error instanceof Error ? error.message : "invalid token"}.`,
        instance: request.path,
      });
      return;
    }
    next();
  };
}
