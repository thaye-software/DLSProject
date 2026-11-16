import express, { type ErrorRequestHandler, type Express, type Request, type Response } from "express";
import { z } from "zod";
import type { CreateUserResult, NewUser, SoftDeleteResult, SyncEmailResult, UpdateProfileResult } from "../../application/ports/user-store.js";
import type { AuthUserUpdate } from "../../application/sync-email.js";
import type { UploadAvatarResult } from "../../application/upload-avatar.js";
import { AVATAR_TYPES, MAX_AVATAR_BYTES } from "../../domain/avatar.js";
import type { ProfileChanges, User, UserAddress } from "../../domain/user.js";
import { notFoundHandler, securityHeaders } from "./http-security.js";
import { sendProblem } from "./problem.js";
import { requireServiceJwt } from "./service-auth.js";
import {
  addressRequestSchema,
  createUserRequestSchema,
  internalUserJson,
  supabaseUpdateWebhookSchema,
  toAddress,
  toProfileChanges,
  updateProfileRequestSchema,
  userJson,
  usernameQuerySchema,
} from "./user-json.js";
import { requireWebhookSecret } from "./webhook-auth.js";

export type AppDependencies = {
  isBrokerConnected: () => boolean;
  isDatabaseReachable: () => Promise<boolean>;
  createUser: (user: NewUser) => Promise<CreateUserResult>;
  isUsernameTaken: (username: string) => Promise<boolean>;
  getProfile: (userId: string) => Promise<User | null>;
  updateProfile: (userId: string, changes: ProfileChanges) => Promise<UpdateProfileResult>;
  setAddress: (userId: string, address: UserAddress) => Promise<User | null>;
  removeAddress: (userId: string) => Promise<User | null>;
  uploadAvatar: (userId: string, contentType: string, bytes: Buffer) => Promise<UploadAvatarResult>;
  deleteAccount: (userId: string) => Promise<SoftDeleteResult>;
  // Deleted users included, for Auth's role lookup.
  getUser: (userId: string) => Promise<User | null>;
  syncConfirmedEmail: (update: AuthUserUpdate) => Promise<SyncEmailResult>;
  internalJwtSecret: string;
  supabaseWebhookSecret: string;
};

// Services allowed to call /internal/users/*: Auth, for the gateway's forward-auth check.
const INTERNAL_CALLERS = ["auth"] as const;
const JSON_BODY_LIMIT = "16kb";
// Supabase sends the whole auth.users row twice (record and old_record).
const WEBHOOK_BODY_LIMIT = "64kb";
const AVATAR_CONTENT_TYPES = AVATAR_TYPES.map((type) => type.contentType);

const userIdSchema = z.uuid();
const userEmailSchema = z.email();

// The gateway verifies the JWT and forwards the user as headers (docs/contracts/README.md §5).
function viewerIdFrom(request: Request): string | null {
  const userId = userIdSchema.safeParse(request.get("x-user-id"));
  return userId.success ? userId.data : null;
}

export function createApp({
  isBrokerConnected,
  isDatabaseReachable,
  createUser,
  isUsernameTaken,
  getProfile,
  updateProfile,
  setAddress,
  removeAddress,
  uploadAvatar,
  deleteAccount,
  getUser,
  syncConfirmedEmail,
  internalJwtSecret,
  supabaseWebhookSecret,
}: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);

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

  app.post("/users", express.json({ limit: JSON_BODY_LIMIT }), async (request, response) => {
    const instance = request.path;
    const userId = viewerIdFrom(request);
    const email = userEmailSchema.safeParse(request.get("x-user-email"));
    if (!userId || !email.success) {
      sendUnauthorized(response, instance, "The request has no valid X-User-Id and X-User-Email from the gateway.");
      return;
    }
    const body = createUserRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, describeIssues(body.error));
      return;
    }

    const result = await createUser({ id: userId, username: body.data.username, email: email.data });
    switch (result.kind) {
      case "created":
        response.status(201).json(userJson(result.user));
        return;
      case "exists":
        response.json(userJson(result.user));
        return;
      case "username_taken":
        sendUsernameTaken(response, instance);
        return;
      case "email_taken":
        sendProblem(response, {
          code: "email_taken",
          title: "Email taken",
          status: 409,
          detail: "User with the same email already exists.",
          instance,
        });
        return;
      case "account_deleted":
        sendProblem(response, {
          code: "account_deleted",
          title: "Account deleted",
          status: 409,
          detail: "This account was deleted and cannot be created again.",
          instance,
        });
        return;
    }
  });

  app.get("/users/username-available", async (request, response) => {
    const query = usernameQuerySchema.safeParse(request.query);
    if (!query.success) {
      sendValidationProblem(response, request.path, describeIssues(query.error));
      return;
    }
    const { username } = query.data;
    response.json({ username, available: !(await isUsernameTaken(username)) });
  });

  app.get("/users/me", async (request, response) => {
    const userId = requireViewer(request, response);
    if (!userId) return;
    sendUserOrNotFound(response, request.path, await getProfile(userId));
  });

  app.patch("/users/me", express.json({ limit: JSON_BODY_LIMIT }), async (request, response) => {
    const instance = request.path;
    const userId = requireViewer(request, response);
    if (!userId) return;
    const body = updateProfileRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, describeIssues(body.error));
      return;
    }

    const result = await updateProfile(userId, toProfileChanges(body.data));
    if (result.kind === "updated") response.json(userJson(result.user));
    else if (result.kind === "not_found") sendUserNotFound(response, instance);
    else sendUsernameTaken(response, instance);
  });

  app.delete("/users/me", async (request, response) => {
    const userId = requireViewer(request, response);
    if (!userId) return;
    const result = await deleteAccount(userId);
    if (result === "not_found") sendUserNotFound(response, request.path);
    else response.status(204).end();
  });

  app.put("/users/me/address", express.json({ limit: JSON_BODY_LIMIT }), async (request, response) => {
    const instance = request.path;
    const userId = requireViewer(request, response);
    if (!userId) return;
    const body = addressRequestSchema.safeParse(request.body);
    if (!body.success) {
      sendValidationProblem(response, instance, describeIssues(body.error));
      return;
    }
    sendUserOrNotFound(response, instance, await setAddress(userId, toAddress(body.data)));
  });

  app.delete("/users/me/address", async (request, response) => {
    const userId = requireViewer(request, response);
    if (!userId) return;
    if (await removeAddress(userId)) response.status(204).end();
    else sendUserNotFound(response, request.path);
  });

  app.put("/users/me/avatar", express.raw({ type: AVATAR_CONTENT_TYPES, limit: MAX_AVATAR_BYTES }), async (request, response) => {
    const instance = request.path;
    const userId = requireViewer(request, response);
    if (!userId) return;
    // express.raw leaves the body unread for any other content type.
    const contentType = request.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const result: UploadAvatarResult = Buffer.isBuffer(request.body)
      ? await uploadAvatar(userId, contentType, request.body)
      : { kind: "unsupported" };

    if (result.kind === "updated") response.json(userJson(result.user));
    else if (result.kind === "not_found") sendUserNotFound(response, instance);
    else {
      sendProblem(response, {
        code: "unsupported_media_type",
        title: "Unsupported image type",
        status: 415,
        detail: "Only JPEG and PNG avatars are supported.",
        instance,
      });
    }
  });

  app.get(
    "/internal/users/:user_id",
    requireServiceJwt({ secret: internalJwtSecret, audience: "users", issuers: INTERNAL_CALLERS }),
    async (request, response) => {
      const userId = userIdSchema.safeParse(request.params.user_id);
      const user = userId.success ? await getUser(userId.data) : null;
      if (user) response.json(internalUserJson(user));
      else sendUserNotFound(response, request.path);
    },
  );

  app.post(
    "/webhooks/supabase/email-confirmed",
    requireWebhookSecret(supabaseWebhookSecret),
    express.json({ limit: WEBHOOK_BODY_LIMIT }),
    async (request, response) => {
      const instance = request.path;
      const body = supabaseUpdateWebhookSchema.safeParse(request.body);
      if (!body.success) {
        sendValidationProblem(response, instance, describeIssues(body.error));
        return;
      }

      const { record, old_record } = body.data;
      const result = await syncConfirmedEmail({ userId: record.id, oldEmail: old_record.email ?? null, newEmail: record.email ?? null });
      switch (result) {
        case "updated":
        case "unchanged":
          response.json({ status: result });
          return;
        case "not_found":
          sendUserNotFound(response, instance);
          return;
        case "email_taken":
          console.error(`Supabase confirmed an email for user ${record.id} that another user already has`);
          sendProblem(response, {
            code: "email_taken",
            title: "Email taken",
            status: 409,
            detail: "Another user already has this email.",
            instance,
          });
          return;
      }
    },
  );

  app.use(notFoundHandler);
  app.use(bodyErrorHandler);
  app.use(unexpectedErrorHandler);

  return app;
}

// The user id from the gateway, or answers 401 and returns null.
function requireViewer(request: Request, response: Response): string | null {
  const userId = viewerIdFrom(request);
  if (!userId) sendUnauthorized(response, request.path, "The request has no valid X-User-Id from the gateway.");
  return userId;
}

function sendUserOrNotFound(response: Response, instance: string, user: User | null): void {
  if (user) response.json(userJson(user));
  else sendUserNotFound(response, instance);
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}

function sendUnauthorized(response: Response, instance: string, detail: string): void {
  sendProblem(response, { code: "unauthorized", title: "Missing or invalid JWT", status: 401, detail, instance });
}

function sendUserNotFound(response: Response, instance: string): void {
  sendProblem(response, { code: "not_found", title: "User not found", status: 404, detail: "User not found.", instance });
}

function sendUsernameTaken(response: Response, instance: string): void {
  sendProblem(response, {
    code: "username_taken",
    title: "Username taken",
    status: 409,
    detail: "User with the same username already exists.",
    instance,
  });
}

function sendValidationProblem(response: Response, instance: string, detail: string): void {
  sendProblem(response, { code: "validation_error", title: "Invalid request", status: 422, detail, instance });
}

// Errors from the body parsers: malformed JSON and bodies over the limit.
const bodyErrorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (error?.type === "entity.parse.failed") {
    sendValidationProblem(response, request.path, "Request body must be valid JSON.");
    return;
  }
  if (error?.type === "entity.too.large") {
    sendProblem(response, {
      code: "payload_too_large",
      title: "Request body too large",
      status: 413,
      detail: request.path.endsWith("/avatar") ? "An avatar can be at most 5 MB." : "The request body is too large.",
      instance: request.path,
    });
    return;
  }
  next(error);
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
