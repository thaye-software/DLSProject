import { z } from "zod";
import { onUserDeleted, type UserDeletedDependencies } from "../../application/anonymise-user.js";
import { logger } from "../../shared/logger.js";
import { handleEvent, type EventHandler } from "./consumer.js";

export const USER_EVENTS_EXCHANGE = "user.events";
export const USER_EVENTS_QUEUE = "messaging.user.events";

export const userDeletedSchema = z.object({
  user_id: z.uuid(),
  version: z.number().int().min(1),
  deleted_at: z.iso.datetime({ offset: true }),
});

export function createUserEventHandlers(dependencies: UserDeletedDependencies): Record<string, EventHandler> {
  return {
    user_deleted: handleEvent(userDeletedSchema, async ({ user_id }, event) => {
      const result = await onUserDeleted(user_id, event.id, dependencies);
      logger.info(
        {
          userId: user_id,
          outcome: result.kind,
          ...(result.kind === "applied" ? { conversations: result.conversations } : {}),
        },
        "User deleted handled",
      );
    }),
  };
}
