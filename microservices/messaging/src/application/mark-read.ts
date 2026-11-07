import { canAccess, type Viewer } from "../domain/chat.js";
import type { ConversationStore } from "./ports/conversation-store.js";

export type MarkReadResult = { outcome: "read" } | { outcome: "not_found" } | { outcome: "forbidden" };

export async function markRead(
  viewer: Viewer,
  conversationId: string,
  store: ConversationStore,
  now: () => Date,
): Promise<MarkReadResult> {
  const conversation = await store.findById(conversationId);
  if (!conversation) return { outcome: "not_found" };
  if (!canAccess(viewer, conversation)) return { outcome: "forbidden" };

  const side = conversation.customerUserId === viewer.userId ? "customer" : "shop";
  await store.markRead(conversationId, side, now());
  return { outcome: "read" };
}
