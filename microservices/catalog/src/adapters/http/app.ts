import express, { type ErrorRequestHandler, type Express, type Response } from "express";
import { z } from "zod";
import type { ReleaseResult, ReserveRequest, ReserveResult } from "../../application/ports/reservation-store.js";
import type { Product } from "../../domain/product.js";
import { productSummaryJson } from "./product-json.js";
import { reservationJson } from "./reservation-json.js";
import { sendProblem } from "./problem.js";
import { requireServiceJwt } from "./service-auth.js";

const productIdSchema = z.uuid();
const idempotencyKeySchema = z.uuid();
const ORDERS_ISSUER = "orders";
const CATALOG_AUDIENCE = "catalog";

const reservationRequestSchema = z.strictObject({
  order_id: z.uuid(),
  items: z
    .array(
      z.strictObject({
        product_id: z.uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
  expires_at: z.iso.datetime({ offset: true }),
});

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  isDatabaseReachable: () => Promise<boolean>;
  getProduct: (productId: string) => Promise<Product | null>;
  reserveStock: (request: ReserveRequest) => Promise<ReserveResult>;
  releaseReservation: (orderId: string) => Promise<ReleaseResult>;
  internalJwtSecret: string;
};

export function createApp({
  isBrokerConnected,
  isDatabaseReachable,
  getProduct,
  reserveStock,
  releaseReservation,
  internalJwtSecret,
}: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  const ordersOnly = requireServiceJwt({ secret: internalJwtSecret, audience: CATALOG_AUDIENCE, issuers: [ORDERS_ISSUER] });

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
        detail: "PostgreSQL did not answer.",
        instance: request.path,
      });
      return;
    }
    response.json({ status: "ok" });
  });

  app.get("/products/:product_id", async (request, response) => {
    const instance = request.path;
    const productId = productIdSchema.safeParse(request.params.product_id);
    const product = productId.success ? await getProduct(productId.data) : null;
    if (!product) {
      sendProblem(response, {
        code: "not_found",
        title: "Product not found",
        status: 404,
        detail: "Product not found.",
        instance,
      });
      return;
    }
    response.json(productSummaryJson(product));
  });

  app.post("/internal/reservations", express.json(), ordersOnly, async (request, response) => {
    const instance = request.path;
    const key = idempotencyKeySchema.safeParse(request.get("idempotency-key"));
    if (!key.success) {
      sendValidationProblem(response, instance, "Idempotency-Key header must be a UUID.");
      return;
    }
    const body = reservationRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, describeIssues(body.error));
      return;
    }
    if (key.data !== body.data.order_id) {
      sendValidationProblem(response, instance, "Idempotency-Key must equal order_id.");
      return;
    }

    const result = await reserveStock({
      orderId: body.data.order_id,
      items: body.data.items.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
      expiresAt: new Date(body.data.expires_at),
    });
    if (result.outcome === "out_of_stock") {
      sendProblem(response, {
        code: "out_of_stock",
        title: "Out of stock",
        status: 409,
        detail: "Out of stock.",
        instance,
        extensions: { unavailable_product_ids: result.unavailableProductIds },
      });
      return;
    }
    response.status(201).json(reservationJson(result.reservation));
  });

  app.delete("/internal/reservations/:order_id", ordersOnly, async (request, response) => {
    const orderId = request.params.order_id;
    if (typeof orderId === "string") await releaseReservation(orderId);
    response.status(204).end();
  });

  app.use(invalidJsonHandler);
  app.use(unexpectedErrorHandler);
  return app;
}

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
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
