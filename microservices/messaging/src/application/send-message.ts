import { canAccess, type Message, type Viewer } from "../domain/chat.js";
import { uuidV5 } from "../domain/uuid-v5.js";
import type { ChatBroadcaster } from "./ports/chat-broadcaster.js";
import type { ConversationStore } from "./ports/conversation-store.js";

// Never change: message ids derived from it must stay the same for retried requests.
const MESSAGE_ID_NAMESPACE = "8f2c1a90-4d3e-4b7a-9c6d-1e0f8a7b5c43";

export type SendMessageResult =
  | { outcome: "sent" | "replayed"; message: Message }
  | { outcome: "not_found" }
  | { outcome: "forbidden" };

export type SendMessageDependencies = {
  store: ConversationStore;
  broadcaster: ChatBroadcaster;
  now: () => Date;
};

// Same conversation, sender and Idempotency-Key always produce the same message id, so a
// concurrent retry hits the unique index and only one insert (and one broadcast) wins.
export function messageIdFor(conversationId: string, senderUserId: string, idempotencyKey: string): string {
  return uuidV5(`${conversationId}/${senderUserId}/${idempotencyKey}`, MESSAGE_ID_NAMESPACE);
}

export async function sendMessage(
  viewer: Viewer,
  conversationId: string,
  content: string,
  idempotencyKey: string,
  { store, broadcaster, now }: SendMessageDependencies,
): Promise<SendMessageResult> {
  const conversation = await store.findById(conversationId);
  if (!conversation) return { outcome: "not_found" };
  if (!canAccess(viewer, conversation)) return { outcome: "forbidden" };

  const existing = await store.findByIdempotencyKey(conversationId, viewer.userId, idempotencyKey);
  if (existing) return { outcome: "replayed", message: existing };

  const fromCustomer = conversation.customerUserId === viewer.userId;
  try {
    const message = await store.insertMessage(
      {
        messageId: messageIdFor(conversationId, viewer.userId, idempotencyKey),
        conversationId,
        senderUserId: viewer.userId,
        content,
        idempotencyKey,
        now: now(),
      },
      fromCustomer ? "shop" : "customer",
    );

    try {
      await broadcaster.messageCreated(message);
    } catch (error) {
      console.error(`Could not broadcast message ${message.messageId}`, error);
    }

    return { outcome: "sent", message };
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const raced = await store.findByIdempotencyKey(conversationId, viewer.userId, idempotencyKey);
    if (!raced) throw error;
    return { outcome: "replayed", message: raced };
  }
}

function isDuplicate(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}
