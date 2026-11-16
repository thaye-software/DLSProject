import type { RequestHandler } from "express";
import { sendProblem } from "./problem.js";

// This service answers JSON to the gateway and other services, never pages for a browser,
// so every browser capability is switched off and nothing may be cached.
const SECURITY_HEADERS = {
  // default-src does not cover frame-ancestors and form-action, so they are set explicitly.
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; form-action 'none'",
  "Permissions-Policy":
    "accelerometer=(), camera=(), display-capture=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

// Mount first, so every response carries the headers, including errors.
export const securityHeaders: RequestHandler = (_request, response, next) => {
  response.set(SECURITY_HEADERS);
  next();
};

// Mount after the last route, so unknown paths get problem+json instead of Express's HTML page.
export const notFoundHandler: RequestHandler = (request, response) => {
  sendProblem(response, {
    code: "not_found",
    title: "Not found",
    status: 404,
    detail: `No route for ${request.method} ${request.path}.`,
    instance: request.path,
  });
};
