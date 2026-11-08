import express, { type ErrorRequestHandler, type Express, type Response } from "express";
import { pathOf, type GatewayRequest, type VerifyResult } from "../../application/verify-request.js";
import { notFoundHandler, securityHeaders } from "./http-security.js";
import { sendProblem, type Problem } from "./problem.js";

export type AppDependencies = {
  verifyRequest: (request: GatewayRequest) => Promise<VerifyResult>;
};

export function createApp({ verifyRequest }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);

  // Up as long as the process is: an outage of Users or Supabase shows in /verify answers, and must not get
  // Auth restarted (that would only drop its cache).
  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  // Traefik ForwardAuth calls with GET; nginx auth_request keeps the client's method, so any method is accepted.
  app.all("/verify", async (request, response) => {
    const original: GatewayRequest = {
      authorization: request.get("authorization"),
      method: request.get("x-forwarded-method"),
      uri: request.get("x-forwarded-uri"),
    };
    // The gateway hands a non-200 answer to the client, so problems name the client's path, not /verify.
    const instance = pathOf(original.uri) || request.path;

    const result = await verifyRequest(original);
    if (result.kind === "allowed") {
      response.set({ "X-User-Id": result.userId, "X-User-Email": result.email, "X-User-Role": result.role });
      response.status(200).end();
      return;
    }
    sendResult(response, result, instance);
  });

  app.use(notFoundHandler);
  app.use(unexpectedErrorHandler);

  return app;
}

function sendResult(response: Response, result: Exclude<VerifyResult, { kind: "allowed" }>, instance: string): void {
  const problem = problemFor(result);
  // RFC 6750: a 401 for a bearer-protected resource names the scheme.
  if (problem.status === 401) response.set("WWW-Authenticate", `Bearer error="invalid_token"`);
  sendProblem(response, { ...problem, instance });
}

function problemFor(result: Exclude<VerifyResult, { kind: "allowed" }>): Omit<Problem, "instance"> {
  switch (result.kind) {
    case "unauthorized":
      return { code: "unauthorized", title: "Missing or invalid JWT", status: 401, detail: `A valid Supabase access token is required: ${result.detail}.` };
    case "account_deleted":
      return { code: "account_deleted", title: "Account deleted", status: 401, detail: "This account was deleted." };
    case "profile_required":
      return { code: "profile_required", title: "Profile required", status: 403, detail: "Create the profile with POST /users first." };
    case "signing_keys_unavailable":
      return {
        code: "signing_keys_unavailable",
        title: "Sign-in check unavailable",
        status: 503,
        detail: "Supabase's signing keys could not be fetched. Try again shortly.",
      };
    case "users_unavailable":
      return {
        code: "users_unavailable",
        title: "Sign-in check unavailable",
        status: 503,
        detail: "The user's role could not be looked up. Try again shortly.",
      };
  }
}

// Express 5 forwards rejected route promises here.
const unexpectedErrorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  console.error(`${request.method} ${request.path} failed`, error);
  sendProblem(response, {
    code: "internal_error",
    title: "Internal error",
    status: 500,
    detail: "The request could not be completed.",
    instance: request.path,
  });
};
