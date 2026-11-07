import { canAccess, type MessageCursor, type Viewer } from "../domain/chat.js";
import type { ConversationStore, MessagePage } from "./ports/conversation-store.js";

export type ListMessagesResult =
  | { outcome: "ok"; page: MessagePage }
  | { outcome: "not_found" }
  | { outcome: "forbidden" };

export async function listMessages(
  viewer: Viewer,
  conversationId: string,
  limit: number,
  before: MessageCursor | null,
  store: ConversationStore,
): Promise<ListMessagesResult> {
  const conversation = await store.findById(conversationId);
  if (!conversation) return { outcome: "not_found" };
  if (!canAccess(viewer, conversation)) return { outcome: "forbidden" };
  return { outcome: "ok", page: await store.listMessages(conversationId, limit, before) };
}
