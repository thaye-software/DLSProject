import { pino } from "pino";
import { pinoHttp } from "pino-http";

// One JSON object per line on stdout; the cluster's log collector picks it up from there.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "notif" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
});

// Logs one line per finished request. Headers and bodies are left out: they carry tokens, signatures and PII.
export const requestLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (request) => request.url === "/health" },
  customLogLevel: (_request, response, error) => {
    if (error || response.statusCode >= 500) return "error";
    if (response.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (request) => ({ id: request.id, method: request.method, url: request.url }),
    res: (response) => ({ statusCode: response.statusCode }),
  },
});
