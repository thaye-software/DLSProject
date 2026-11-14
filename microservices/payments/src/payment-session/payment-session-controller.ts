import express, { type Router } from "express";
import { z } from "zod";
import { logger } from "../shared/logger.js";
import { sendProblem, sendValidationProblem } from "../shared/problem.js";
import type { CreatePaymentSessionResult } from "./payment-session-types.js";

const createPaymentRequestSchema = z.strictObject({ order_id: z.uuid() });
const userIdSchema = z.uuid();

export function paymentSessionController(
  createPaymentSession: (request: { orderId: string; userId: string }) => Promise<CreatePaymentSessionResult>,
): Router {
  const router = express.Router();

  router.post("/payments", express.json(), async (request, response) => {
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
      logger.error({ err: error, orderId: body.data.order_id }, "Failed to start payment");
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
        logger.info({ orderId: body.data.order_id }, "Payment session created");
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

  return router;
}
