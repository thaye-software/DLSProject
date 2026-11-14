import express, { type ErrorRequestHandler, type Express } from "express";
import { contactController } from "./contact/contact-controller.js";
import type { ContactMessage } from "./contact/contact-types.js";
import { notFoundHandler, securityHeaders } from "./shared/http-security.js";
import { requestLogger } from "./shared/logger.js";
import { sendProblem, sendValidationProblem } from "./shared/problem.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  sendContactMessage: (contactMessage: ContactMessage) => Promise<void>;
};

export function createApp({ isBrokerConnected, sendContactMessage }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestLogger);
  app.use(securityHeaders);

  app.get("/health", (request, response) => {
    if (isBrokerConnected()) {
      response.json({ status: "ok" });
      return;
    }
    sendProblem(response, {
      code: "broker_unavailable",
      title: "Message broker unavailable",
      status: 503,
      detail: "The RabbitMQ channel is closed.",
      instance: request.path,
    });
  });

  app.use(contactController(sendContactMessage));

  app.use(notFoundHandler);
  app.use(invalidJsonHandler);

  return app;
}

const invalidJsonHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (error?.type !== "entity.parse.failed") {
    next(error);
    return;
  }
  sendValidationProblem(response, request.path, "Request body must be valid JSON.");
};
