import express, { type ErrorRequestHandler, type Express, type Request, type Response } from "express";
import { z } from "zod";
import type { OpenConversationResult } from "../../application/open-conversation.js";
import type { ListMessagesResult } from "../../application/list-messages.js";
import type { MarkReadResult } from "../../application/mark-read.js";
import type { SendMessageResult } from "../../application/send-message.js";
import type { Conversation, MessageCursor, Viewer } from "../../domain/chat.js";
import { conversationJson, listMessagesQuerySchema, messageJson, messagePageJson, openConversationRequestSchema, sendMessageRequestSchema } from "./chat-json.js";
import { notFoundHandler, securityHeaders } from "./http-security.js";
import { sendProblem, sendValidationProblem } from "./problem.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  isDatabaseReachable: () => Promise<boolean>;
  openConversation: (viewer: Viewer, productId: string) => Promise<OpenConversationResult>;
  listConversations: (viewer: Viewer) => Promise<Conversation[]>;
  listMessages: (viewer: Viewer, conversationId: string, limit: number, before: MessageCursor | null) => Promise<ListMessagesResult>;
  sendMessage: (viewer: Viewer, conversationId: string, content: string, idempotencyKey: string) => Promise<SendMessageResult>;
  markRead: (viewer: Viewer, conversationId: string) => Promise<MarkReadResult>;
};

const userIdSchema = z.uuid();
const conversationIdSchema = z.uuid();
const idempotencyKeySchema = z.uuid();

function viewerFrom(request: Request): Viewer | null {
  const userId = userIdSchema.safeParse(request.get("x-user-id"));
  if (!userId.success) return null;
  const email = request.get("x-user-email")?.trim() || null;
  return { userId: userId.data, isAdmin: request.get("x-user-role") === "admin", email };
}

function sendUnauthorized(response: Response, instance: string): void {
  sendProblem(response, {
    code: "unauthorized",
    title: "Missing or invalid JWT",
    status: 401,
    detail: "The request has no valid X-User-Id from the gateway.",
    instance,
  });
}

function sendForbidden(response: Response, instance: string, detail: string): void {
  sendProblem(response, { code: "forbidden", title: "Forbidden", status: 403, detail, instance });
}

function sendNotFound(response: Response, instance: string, detail: string): void {
  sendProblem(response, { code: "not_found", title: "Not found", status: 404, detail, instance });
}

export function createApp({
  isBrokerConnected,
  isDatabaseReachable,
  openConversation,
  listConversations,
  listMessages,
  sendMessage,
  markRead,
}: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "32kb" }));

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
        detail: "MongoDB did not answer.",
        instance: request.path,
      });
      return;
    }
    response.json({ status: "ok" });
  });

  app.post("/conversations", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance);
      return;
    }
    const body = openConversationRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, z.prettifyError(body.error));
      return;
    }
    const result = await openConversation(viewer, body.data.product_id);
    if (result.outcome === "forbidden") {
      sendForbidden(response, instance, "Admins cannot open conversations.");
      return;
    }
    if (result.outcome === "product_not_found") {
      sendNotFound(response, instance, "Product not found.");
      return;
    }
    if (result.outcome === "catalog_unavailable") {
      sendProblem(response, {
        code: "catalog_unavailable",
        title: "Catalog unavailable",
        status: 502,
        detail: "Catalog did not answer.",
        instance,
      });
      return;
    }
    response.status(result.outcome === "created" ? 201 : 200).json(conversationJson(result.conversation, viewer));
  });

  app.get("/conversations", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance);
      return;
    }
    const items = await listConversations(viewer);
    response.json({ items: items.map((conversation) => conversationJson(conversation, viewer)) });
  });

  app.get("/conversations/:conversation_id/messages", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance);
      return;
    }
    const conversationId = conversationIdSchema.safeParse(request.params.conversation_id);
    if (!conversationId.success) {
      sendNotFound(response, instance, "Conversation not found.");
      return;
    }
    const query = listMessagesQuerySchema.safeParse(request.query);
    if (!query.success) {
      sendValidationProblem(response, instance, z.prettifyError(query.error));
      return;
    }
    const result = await listMessages(viewer, conversationId.data, query.data.limit, query.data.before);
    if (result.outcome === "not_found") {
      sendNotFound(response, instance, "Conversation not found.");
      return;
    }
    if (result.outcome === "forbidden") {
      sendForbidden(response, instance, "Not a participant of this conversation.");
      return;
    }
    response.json(messagePageJson(result.page.items, result.page.nextCursor));
  });

  app.post("/conversations/:conversation_id/messages", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance);
      return;
    }
    const conversationId = conversationIdSchema.safeParse(request.params.conversation_id);
    if (!conversationId.success) {
      sendNotFound(response, instance, "Conversation not found.");
      return;
    }
    const idempotencyKey = idempotencyKeySchema.safeParse(request.get("idempotency-key"));
    if (!idempotencyKey.success) {
      sendValidationProblem(response, instance, "Idempotency-Key header must be a UUID.");
      return;
    }
    const body = sendMessageRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, z.prettifyError(body.error));
      return;
    }
    const result = await sendMessage(viewer, conversationId.data, body.data.content, idempotencyKey.data);
    if (result.outcome === "not_found") {
      sendNotFound(response, instance, "Conversation not found.");
      return;
    }
    if (result.outcome === "forbidden") {
      sendForbidden(response, instance, "Not a participant of this conversation.");
      return;
    }
    response.status(201).json(messageJson(result.message));
  });

  app.post("/conversations/:conversation_id/read", async (request, response) => {
    const instance = request.path;
    const viewer = viewerFrom(request);
    if (!viewer) {
      sendUnauthorized(response, instance);
      return;
    }
    const conversationId = conversationIdSchema.safeParse(request.params.conversation_id);
    if (!conversationId.success) {
      sendNotFound(response, instance, "Conversation not found.");
      return;
    }
    const result = await markRead(viewer, conversationId.data);
    if (result.outcome === "not_found") {
      sendNotFound(response, instance, "Conversation not found.");
      return;
    }
    if (result.outcome === "forbidden") {
      sendForbidden(response, instance, "Not a participant of this conversation.");
      return;
    }
    response.status(204).end();
  });

  app.use(notFoundHandler);
  app.use(unexpectedErrorHandler);

  return app;
}

const unexpectedErrorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof SyntaxError) {
    sendValidationProblem(response, request.path, "Body is not JSON.");
    return;
  }
  console.error(`${request.method} ${request.path} failed`, error);
  sendProblem(response, {
    code: "internal_error",
    title: "Internal error",
    status: 500,
    detail: "The request could not be completed.",
    instance: request.path,
  });
};
