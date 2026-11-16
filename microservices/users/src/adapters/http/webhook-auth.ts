import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { sendProblem } from "./problem.js";

export const WEBHOOK_SECRET_HEADER = "x-supabasewebhook-secret";

// Supabase database webhooks carry a shared secret header (as in the monolith). Hashing both sides first gives
// equal-length buffers, so the comparison takes the same time whatever the caller sent.
export function requireWebhookSecret(secret: string): RequestHandler {
  const expected = sha256(secret);

  return (request, response, next) => {
    if (!timingSafeEqual(sha256(request.get(WEBHOOK_SECRET_HEADER) ?? ""), expected)) {
      sendProblem(response, {
        code: "unauthorized",
        title: "Invalid webhook secret",
        status: 401,
        detail: "Invalid webhook secret.",
        instance: request.path,
      });
      return;
    }
    next();
  };
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest();
