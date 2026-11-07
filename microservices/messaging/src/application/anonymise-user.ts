import { DELETED_DISPLAY_NAME } from "../domain/chat.js";
import type { Inbox } from "./ports/inbox.js";
import type { ConversationStore } from "./ports/conversation-store.js";

export type AnonymiseResult = { kind: "duplicate" } | { kind: "applied"; conversations: number };

export type UserDeletedDependencies = {
  store: ConversationStore;
  inbox: Inbox;
};

export async function onUserDeleted(
  userId: string,
  eventId: string,
  { store, inbox }: UserDeletedDependencies,
): Promise<AnonymiseResult> {
  if (await inbox.has(eventId)) return { kind: "duplicate" };
  const conversations = await store.anonymiseCustomer(userId, DELETED_DISPLAY_NAME);
  await inbox.record(eventId, "user_deleted");
  return { kind: "applied", conversations };
}
