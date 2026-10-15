import express, { type ErrorRequestHandler, type Express, type RequestHandler, type Response } from "express";
import { z } from "zod";
import type { CreatePaymentSessionResult } from "../../application/create-payment-session.js";
import { sendProblem } from "./problem.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  createPaymentSession: (request: { orderId: string; userId: string }) => Promise<CreatePaymentSessionResult>;
  stripeWebhook?: RequestHandler;
};

const createPaymentRequestSchema = z.strictObject({ order_id: z.uuid() });
const userIdSchema = z.uuid();

export function createApp({ isBrokerConnected, createPaymentSession, stripeWebhook }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");

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

  app.post("/payments", express.json(), async (request, response) => {
    const instance = request.path;

    const userId = userIdSchema.safeParse(request.get("x-user-id"));
    if (!userId.success) {
      sendProblem(response, {
        code: "unauthenticated",
        title: "Not authenticated",
        status: 401,
        detail: "The request has no valid X-User-Id from the gateway.",
        instance,
      });
      return;
    }

    const body = createPaymentRequestSchema.safeParse(request.body);
    if (!body.success) {
      const detail = body.error.issues
        .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
        .join("; ");
      sendValidationProblem(response, instance, detail);
      return;
    }

    let result: CreatePaymentSessionResult;
    try {
      result = await createPaymentSession({ orderId: body.data.order_id, userId: userId.data });
    } catch (error) {
      console.error(`Failed to start payment for order ${body.data.order_id}`, error);
      sendProblem(response, {
        code: "upstream_unavailable",
        title: "Payment could not be started",
        status: 502,
        detail: "Orders or Stripe did not answer as expected.",
        instance,
      });
      return;
    }

    switch (result.outcome) {
      case "created":
        response.status(201).json(result.session);
        return;
      case "not_found":
        sendProblem(response, { code: "not_found", title: "Order not found", status: 404, detail: "Order not found.", instance });
        return;
      case "not_payable":
        sendProblem(response, {
          code: "order_not_payable",
          title: "Order is not payable (not RESERVED or expired)",
          status: 409,
          detail: "Order is not payable (not RESERVED or expired).",
          instance,
        });
        return;
    }
  });

  if (stripeWebhook) {
    app.post("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook);
  }

  app.use(invalidJsonHandler);

  return app;
}

function sendValidationProblem(response: Response, instance: string, detail: string): void {
  sendProblem(response, { code: "validation_error", title: "Invalid request", status: 422, detail, instance });
}

const invalidJsonHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (error?.type !== "entity.parse.failed") {
    next(error);
    return;
  }
  sendValidationProblem(response, request.path, "Request body must be valid JSON.");
};
