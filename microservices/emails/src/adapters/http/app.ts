import express, { type ErrorRequestHandler, type Express } from "express";
import { z } from "zod";
import type { ContactMessage } from "../../domain/contact-message.js";
import { sendProblem } from "./problem.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  sendContactMessage: (contactMessage: ContactMessage) => Promise<void>;
};

const contactMessageSchema = z.strictObject({
  name: z.string().min(1),
  email: z.email(),
  message: z.string().min(1),
});

export function createApp({ isBrokerConnected, sendContactMessage }: AppDependencies): Express {
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

  app.post("/contact", express.json(), async (request, response) => {
    const contactMessage = contactMessageSchema.safeParse(request.body);
    if (!contactMessage.success) {
      const detail = contactMessage.error.issues
        .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
        .join("; ");
      sendValidationProblem(response, request.path, detail);
      return;
    }

    try {
      await sendContactMessage(contactMessage.data);
    } catch (error) {
      console.error("Failed to send contact message", error);
      sendProblem(response, {
        code: "email_unavailable",
        title: "Email provider unavailable",
        status: 502,
        detail: "Email provider unavailable.",
        instance: request.path,
      });
      return;
    }
    response.sendStatus(202);
  });

  app.use(invalidJsonHandler);

  return app;
}

function sendValidationProblem(response: express.Response, instance: string, detail: string): void {
  sendProblem(response, { code: "validation_error", title: "Invalid request", status: 422, detail, instance });
}

const invalidJsonHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (error?.type !== "entity.parse.failed") {
    next(error);
    return;
  }
  sendValidationProblem(response, request.path, "Request body must be valid JSON.");
};
