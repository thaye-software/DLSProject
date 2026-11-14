import express, { type Router } from "express";
import { z } from "zod";
import { logger } from "../shared/logger.js";
import { sendProblem, sendValidationProblem } from "../shared/problem.js";
import type { ContactMessage } from "./contact-types.js";

const contactMessageSchema = z.strictObject({
  name: z.string().min(1),
  email: z.email(),
  message: z.string().min(1),
});

export function contactController(sendContactMessage: (contactMessage: ContactMessage) => Promise<void>): Router {
  const router = express.Router();

  router.post("/contact", express.json(), async (request, response) => {
    logger.debug({ input: request.body }, "Request input");
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
      logger.error({ err: error }, "Failed to send contact message");
      sendProblem(response, {
        code: "email_unavailable",
        title: "Email provider unavailable",
        status: 502,
        detail: "Email provider unavailable.",
        instance: request.path,
      });
      return;
    }
    logger.info("Contact message sent");
    response.sendStatus(202);
  });

  return router;
}
