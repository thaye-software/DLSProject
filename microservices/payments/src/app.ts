import express, { type ErrorRequestHandler, type Express, type Router } from "express";
import { paymentSessionController } from "./payment-session/payment-session-controller.js";
import type { CreatePaymentSessionResult } from "./payment-session/payment-session-types.js";
import { notFoundHandler, securityHeaders } from "./shared/http-security.js";
import { logger, requestLogger } from "./shared/logger.js";
import { sendProblem, sendValidationProblem } from "./shared/problem.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  createPaymentSession: (request: { orderId: string; userId: string }) => Promise<CreatePaymentSessionResult>;
  // Only mounted when the Stripe provider is configured (see paymentWebhookController).
  stripeWebhook?: Router;
};

export function createApp({ isBrokerConnected, createPaymentSession, stripeWebhook }: AppDependencies): Express {
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

  app.use(paymentSessionController(createPaymentSession));
  if (stripeWebhook) app.use(stripeWebhook);

  app.use(notFoundHandler);
  app.use(invalidJsonHandler);

  return app;
}

const invalidJsonHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (error?.type !== "entity.parse.failed") {
    logger.error({ err: error }, "Unhandled request error");
    next(error);
    return;
  }
  sendValidationProblem(response, request.path, "Request body must be valid JSON.");
};
