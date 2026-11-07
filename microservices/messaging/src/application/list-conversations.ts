import type { Conversation, Viewer } from "../domain/chat.js";
import type { ConversationStore } from "./ports/conversation-store.js";

export function listConversations(viewer: Viewer, store: ConversationStore): Promise<Conversation[]> {
  return store.listFor(viewer);
}
