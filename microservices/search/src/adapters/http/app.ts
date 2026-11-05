import express, { type ErrorRequestHandler, type Express } from "express";
import type { SearchQuery, SearchResult } from "../../domain/listing.js";
import { sendProblem } from "./problem.js";
import { notFoundHandler, securityHeaders } from "./http-security.js";
import { searchQuerySchema, searchResultsJson } from "./search-json.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  isDatabaseReachable: () => Promise<boolean>;
  search: (query: SearchQuery) => Promise<SearchResult>;
};

export function createApp({ isBrokerConnected, isDatabaseReachable, search }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);

  // Redis is not checked: without it searches still work, just uncached.
  app.get("/health", async (request, response) => {
    if (!isBrokerConnected()) {
      sendProblem(response, {
        code: "broker_unavailable",
        title: "Message broker unavailable",
        status: 503,
        detail: "The RabbitMQ channel is closed.",
        instance: request.path,
      });
      return;
    }
    if (!(await isDatabaseReachable())) {
      sendProblem(response, {
        code: "database_unavailable",
        title: "Database unavailable",
        status: 503,
        detail: "MongoDB did not answer.",
        instance: request.path,
      });
      return;
    }
    response.json({ status: "ok" });
  });

  app.get("/search", async (request, response) => {
    const query = searchQuerySchema.safeParse(request.query);
    if (!query.success) {
      const detail = query.error.issues
        .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
        .join("; ");
      sendProblem(response, { code: "validation_error", title: "Invalid request", status: 422, detail, instance: request.path });
      return;
    }
    response.json(searchResultsJson(await search(query.data), query.data));
  });

  app.use(notFoundHandler);
  app.use(unexpectedErrorHandler);

  return app;
}

// Express 5 forwards rejected route promises here, e.g. when MongoDB is down.
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
