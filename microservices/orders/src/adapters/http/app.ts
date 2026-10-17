import express, { type ErrorRequestHandler, type Express, type Request, type Response } from "express";
import { z } from "zod";
import type { AdminTargetStatus, CancelRejection, StatusChangeRejection } from "../../application/change-order.js";
import type { CreateOrderRequest, CreateOrderResult } from "../../application/create-order.js";
import type { PaymentDetailsResult } from "../../application/get-payment-details.js";
import type { CommandResult } from "../../application/ports/order-command-store.js";
import type { OrderPage } from "../../application/ports/order-repository.js";
import type { ListOrdersRequest, Viewer } from "../../application/read-orders.js";
import type { Order } from "../../domain/order.js";
import {
  createOrderRequestSchema,
  listOrdersQuerySchema,
  orderJson,
  paymentDetailsJson,
  toAddress,
  updateOrderStatusRequestSchema,
} from "./order-json.js";
import { sendProblem } from "./problem.js";
import { requireServiceJwt } from "./service-auth.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  isDatabaseReachable: () => Promise<boolean>;
  createOrder: (request: CreateOrderRequest) => Promise<CreateOrderResult>;
  getOrder: (orderId: string, viewer: Viewer) => Promise<Order | null>;
  listOrders: (request: ListOrdersRequest) => Promise<OrderPage>;
  getPaymentDetails: (orderId: string) => Promise<PaymentDetailsResult>;
  cancelOrder: (orderId: string, viewer: Viewer) => Promise<CommandResult<CancelRejection>>;
  changeOrderStatus: (orderId: string, status: AdminTargetStatus, admin: Viewer) => Promise<CommandResult<StatusChangeRejection>>;
  internalJwtSecret: string;
};

// Services allowed to call /internal/orders/*.
const INTERNAL_CALLERS = ["payment"] as const;

const userIdSchema = z.uuid();
const userEmailSchema = z.email();
const idempotencyKeySchema = z.uuid();
const orderIdSchema = z.uuid();

// The gateway verifies the JWT and forwards the user as headers (docs/contracts/README.md §5).
function viewerFrom(request: Request): Viewer | null {
  const userId = userIdSchema.safeParse(request.get("x-user-id"));
  if (!userId.success) return null;
  return { userId: userId.data, isAdmin: request.get("x-user-role") === "admin" };
}

function sendUnauthorized(response: Response, instance: string, detail: string): void {
  sendProblem(response, { code: "unauthorized", title: "Missing or invalid JWT", status: 401, detail, instance });
}

export function createApp({
  isBrokerConnected,
  isDatabaseReachable,
  createOrder,
  getOrder,
  listOrders,
  getPaymentDetails,
  cancelOrder,
  changeOrderStatus,
  internalJwtSecret,
}: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");

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

  app.post("/orders", express.json(), async (request, response) => {
    const instance = request.path;

    const viewer = viewerFrom(request);
    const userEmail = userEmailSchema.safeParse(request.get("x-user-email"));
    if (!viewer || !userEmail.success) {
      sendUnauthorized(response, instance, "The request has no valid X-User-Id and X-User-Email from the gateway.");
      return;
    }

    const idempotencyKey = idempotencyKeySchema.safeParse(request.get("idempotency-key"));
    if (!idempotencyKey.success) {
      sendValidationProblem(response, instance, "Idempotency-Key header must be a UUID.");
      return;
    }

    const body = createOrderRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, describeIssues(body.error));
      return;
    }
    if (body.data.offer_token !== null) {
      // shortcut: offers are rejected until the offer_token format is agreed ("offer_token format" in DECISIONS.md).
      sendValidationProblem(response, instance, "offer_token: offers are not supported yet; send null.");
      return;
    }

    let result: CreateOrderResult;
    try {
      result = await createOrder({
        userId: viewer.userId,
        customerEmail: userEmail.data,
        idempotencyKey: idempotencyKey.data,
        items: body.data.items.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
        billingAddress: toAddress(body.data.billing_address),
        deliveryAddress: toAddress(body.data.delivery_address),
      });
    } catch (error) {
      console.error(`Failed to create order (Idempotency-Key ${idempotencyKey.data})`, error);
      sendProblem(response, {
        code: "upstream_unavailable",
        title: "Order could not be created",
        status: 502,
        detail: "Catalog or the database did not answer as expected. Retry with the same Idempotency-Key.",
        instance,
      });
      return;
    }

    switch (result.outcome) {
      case "created":
      case "replayed":
        response.status(201).json(orderJson(result.order));
        return;
      case "unavailable":
        sendProblem(response, {
          code: "product_unavailable",
          title: "Product not available",
          status: 409,
          detail: "Product not available.",
          instance,
          extensions: { unavailable_product_ids: result.productIds },
        });
        return;
    }
  });

  app.get("/orders", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance, "The request has no valid X-User-Id from the gateway.");
      return;
    }

    const query = listOrdersQuerySchema.safeParse(request.query);
    if (!query.success) {
      sendValidationProblem(response, instance, describeIssues(query.error));
      return;
    }

    const { status, page, page_size } = query.data;
    const { orders, total } = await listOrders({ viewer, statuses: status, page, pageSize: page_size });
    response.json({ items: orders.map(orderJson), page, page_size, total });
  });

  app.get("/orders/:order_id", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance, "The request has no valid X-User-Id from the gateway.");
      return;
    }

    const orderId = orderIdSchema.safeParse(request.params.order_id);
    const order = orderId.success ? await getOrder(orderId.data, viewer) : null;
    if (!order) {
      sendProblem(response, { code: "not_found", title: "Order not found", status: 404, detail: "Order not found.", instance });
      return;
    }
    response.json(orderJson(order));
  });

  app.post("/orders/:order_id/cancel", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance, "The request has no valid X-User-Id from the gateway.");
      return;
    }

    const orderId = orderIdSchema.safeParse(request.params.order_id);
    const result: CommandResult<CancelRejection> = orderId.success ? await cancelOrder(orderId.data, viewer) : { kind: "not_found" };

    if (result.kind === "done") {
      response.json(orderJson(result.order));
    } else if (result.kind === "not_found" || result.reason === "not_found") {
      sendNotFound(response, instance);
    } else {
      sendProblem(response, {
        code: "order_not_cancellable",
        title: "Order can no longer be cancelled",
        status: 409,
        detail: "Only an unpaid (RESERVED) order can be cancelled; ask the shop to cancel a paid order.",
        instance,
      });
    }
  });

  app.patch("/orders/:order_id/status", express.json(), async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance, "The request has no valid X-User-Id from the gateway.");
      return;
    }
    if (!viewer.isAdmin) {
      sendProblem(response, { code: "forbidden", title: "Admin role required", status: 403, detail: "Admin role required.", instance });
      return;
    }

    const orderId = orderIdSchema.safeParse(request.params.order_id);
    if (!orderId.success) {
      sendNotFound(response, instance);
      return;
    }
    const body = updateOrderStatusRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, describeIssues(body.error));
      return;
    }

    const result = await changeOrderStatus(orderId.data, body.data.status, viewer);
    if (result.kind === "done") {
      response.json(orderJson(result.order));
    } else if (result.kind === "not_found") {
      sendNotFound(response, instance);
    } else {
      sendProblem(response, {
        code: "invalid_status_transition",
        title: "Invalid status change",
        status: 409,
        detail: `An order cannot be moved to ${body.data.status} from its current status.`,
        instance,
      });
    }
  });

  app.get(
    "/internal/orders/:order_id/payment-details",
    requireServiceJwt({ secret: internalJwtSecret, audience: "orders", issuers: INTERNAL_CALLERS }),
    async (request, response) => {
      const instance = request.path;
      const orderId = orderIdSchema.safeParse(request.params.order_id);
      const result: PaymentDetailsResult = orderId.success ? await getPaymentDetails(orderId.data) : { outcome: "not_found" };

      switch (result.outcome) {
        case "payable":
          response.json(paymentDetailsJson(result.details));
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
    },
  );

  app.use(invalidJsonHandler);
  app.use(unexpectedErrorHandler);

  return app;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}

function sendNotFound(response: Response, instance: string): void {
  sendProblem(response, { code: "not_found", title: "Order not found", status: 404, detail: "Order not found.", instance });
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

// Express 5 forwards rejected route promises here, e.g. when the database is down.
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
