import { z } from "zod";
import { onUserDeleted, type UserDeletedDependencies } from "../../application/anonymise-user.js";
import { handleEvent, type EventHandler } from "./consumer.js";

export const USER_EVENTS_EXCHANGE = "user.events";
export const USER_EVENTS_QUEUE = "orders.user.events";

export const userDeletedSchema = z.object({ user_id: z.uuid() });

export function createUserEventHandlers(dependencies: UserDeletedDependencies): Record<string, EventHandler> {
  return {
    user_deleted: handleEvent(userDeletedSchema, async ({ user_id }, event) => {
      const result = await onUserDeleted(user_id, event.id, dependencies);
      const outcome = result.kind === "duplicate" ? "already handled, skipped" : `anonymised ${result.orders} order(s), cancelled ${result.cancelled} unpaid`;
      console.log(`${event.type} ${event.id}: user ${user_id} ${outcome}`);
    }),
  };
}
