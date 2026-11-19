import { randomBytes } from "node:crypto";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { InvalidTokenError, type VerifyToken } from "./auth.js";
import type { Config, ServiceName } from "./config.js";
import { sendProblem } from "./problem.js";
import { matchRoute } from "./routes.js";

export type AppDependencies = { config: Config; verifyToken: VerifyToken };

const IDENTITY_HEADERS = ["x-user-id", "x-user-role", "x-user-email"] as const;
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;
const TIMEOUT_CODES = new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT"]);

export function createApp({ config, verifyToken }: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");

  const proxies = {} as Partial<Record<ServiceName, express.RequestHandler>>;
  for (const [service, target] of Object.entries(config.upstreams) as [ServiceName, string][]) {
    proxies[service] = createProxyMiddleware({
      target,
      changeOrigin: true,
      proxyTimeout: config.upstreamTimeoutMs,
      on: {
        error: (err, req, res) => {
          // http-proxy aborts a timed-out upstream request, which surfaces as ECONNRESET.
          const code = (err as NodeJS.ErrnoException).code ?? "";
          const started = (req as express.Request & { startedAt?: number }).startedAt ?? Date.now();
          const timedOut = TIMEOUT_CODES.has(code) || (code === "ECONNRESET" && Date.now() - started >= config.upstreamTimeoutMs);
          const response = res as express.Response;
          if (response.headersSent || typeof response.status !== "function") return void res.destroy?.();
          sendProblem(response, {
            code: timedOut ? "gateway-timeout" : "bad-gateway",
            title: timedOut ? "Gateway Timeout" : "Bad Gateway",
            status: timedOut ? 504 : 502,
            detail: timedOut ? "The upstream service did not respond in time." : "The upstream service is unavailable.",
            instance: (req as express.Request).path,
          });
        },
      },
    }) as express.RequestHandler;
  }

  app.use((req, res, next) => {
    // Identity is only ever set by this gateway after verifying a token.
    for (const header of IDENTITY_HEADERS) delete req.headers[header];

    const origin = req.headers.origin;
    if (origin !== undefined && config.corsOrigins.includes(origin)) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
      });
    }
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  });

  app.get("/health", (_req, res) => void res.json({ status: "ok" }));

  app.use(async (req, res, next) => {
    const route = matchRoute(req.path);
    if (route === null) {
      return sendProblem(res, { code: "not-found", title: "Not Found", status: 404, detail: "No such route.", instance: req.path });
    }
    const proxy = proxies[route.service];
    if (proxy === undefined) {
      return sendProblem(res, {
        code: "service-unavailable",
        title: "Service Unavailable",
        status: 503,
        detail: "The upstream service is not configured.",
        instance: req.path,
      });
    }

    if (route.auth !== "none") {
      const header = req.headers.authorization;
      if (header !== undefined || route.auth === "required") {
        try {
          const match = /^Bearer (\S+)$/.exec(header ?? "");
          if (match === null) throw new InvalidTokenError("Missing bearer token");
          const identity = await verifyToken(match[1]!);
          req.headers["x-user-id"] = identity.userId;
          req.headers["x-user-email"] = identity.email;
          req.headers["x-user-role"] = identity.role;
        } catch (error) {
          if (!(error instanceof InvalidTokenError)) return next(error);
          return sendProblem(res, {
            code: "unauthorized",
            title: "Unauthorized",
            status: 401,
            detail: "A valid bearer token is required.",
            instance: req.path,
          });
        }
      }
    }

    const incoming = req.headers.traceparent;
    if (typeof incoming !== "string" || !TRACEPARENT.test(incoming)) {
      req.headers.traceparent = `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
    }
    (req as express.Request & { startedAt?: number }).startedAt = Date.now();
    proxy(req, res, next);
  });

  return app;
}
