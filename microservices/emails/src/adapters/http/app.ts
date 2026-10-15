import express, { type Express } from "express";
import { sendProblem } from "./problem.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
};

export function createApp({ isBrokerConnected }: AppDependencies): Express {
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

  return app;
}
