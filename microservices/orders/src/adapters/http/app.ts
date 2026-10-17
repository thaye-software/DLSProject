import express, { type Express } from "express";
import { sendProblem } from "./problem.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  isDatabaseReachable: () => Promise<boolean>;
};

export function createApp({ isBrokerConnected, isDatabaseReachable }: AppDependencies): Express {
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

  return app;
}
