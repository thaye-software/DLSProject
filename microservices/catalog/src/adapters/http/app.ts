import express, { type Express } from "express";
import { z } from "zod";
import type { Product } from "../../domain/product.js";
import { productSummaryJson } from "./product-json.js";
import { sendProblem } from "./problem.js";

const productIdSchema = z.uuid();

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  isDatabaseReachable: () => Promise<boolean>;
  getProduct: (productId: string) => Promise<Product | null>;
};

export function createApp({ isBrokerConnected, isDatabaseReachable, getProduct }: AppDependencies): Express {
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

  return app;
}
