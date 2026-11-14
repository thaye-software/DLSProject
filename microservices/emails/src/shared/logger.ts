import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { pino } from "pino";

type LogFields = Record<string, unknown>;

// Fields every log line inherits while a request or event is being handled (requestId, eventId, ...).
const context = new AsyncLocalStorage<LogFields>();

// One JSON object per line on stdout; the cluster's log collector picks it up from there.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "notif" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  // A copy: pino merges each line's own fields into the object it gets here.
  mixin: () => ({ ...context.getStore() }),
  // Full inputs are logged under "input" at debug level; these parts of them are personal data or secrets.
  redact: ["input.name", "input.email", "input.message", "input.data.customer_email", "input.data.billing_address"],
});

export function withLogContext<T>(fields: LogFields, run: () => T): T {
  return context.run({ ...context.getStore(), ...fields }, run);
}

// Entry point: info when a request arrives, debug with the duration when it is answered (warn/error if it failed).
export const requestLogger: RequestHandler = (request, response, next) => {
  if (request.path === "/health") {
    next();
    return;
  }
  withLogContext({ requestId: randomUUID() }, () => {
    const startedAt = performance.now();
    const http = { method: request.method, url: request.originalUrl };
    logger.info(http, "Request received");
    response.on(
      "finish",
      AsyncLocalStorage.bind(() => {
        const level = response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "debug";
        logger[level]({ ...http, statusCode: response.statusCode, durationMs: elapsedMs(startedAt) }, "Request completed");
      }),
    );
    next();
  });
};

// Exit point: info before the call, debug with the duration when the dependency answers.
// A failure is wrapped so the error says which call it was.
export async function callDependency<T>(operation: string, fields: LogFields, call: () => Promise<T>): Promise<T> {
  logger.info({ operation, ...fields }, "Dependency call started");
  const startedAt = performance.now();
  try {
    const result = await call();
    logger.debug({ operation, ...fields, durationMs: elapsedMs(startedAt) }, "Dependency call returned");
    return result;
  } catch (error) {
    throw new Error(`${operation} failed`, { cause: error });
  }
}

export function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
