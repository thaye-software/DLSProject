import "server-only";
import { gatewayFetch } from "@/lib/gateway";

// Typed from docs/contracts/openapi.yaml (messaging service: chat-json.ts)
export type OpenConversationRequest = { product_id: string };
export type ChatMessage = {
  message_id: string;
  conversation_id: string;
  sender_user_id: string;
  content: string;
  created_at: string;
};
export type MessagePage = { items: ChatMessage[]; next_cursor: string | null };
export type Conversation = {
  conversation_id: string;
  customer_user_id: string;
  customer_display_name: string;
  product_id: string;
  product_name: string;
  thumbnail_url: string | null;
  last_message: ChatMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};
export type ConversationList = { items: Conversation[] };

export const openConversation = (productId: string) =>
  gatewayFetch<Conversation>("/conversations", {
    method: "POST",
    body: { product_id: productId } satisfies OpenConversationRequest,
  });

export const listConversations = () => gatewayFetch<ConversationList>("/conversations");

// `before` is a MessagePage.next_cursor; items come back oldest first.
export const listMessages = (conversationId: string, before?: string) =>
  gatewayFetch<MessagePage>(`/conversations/${conversationId}/messages`, { query: { before } });

// The service requires an Idempotency-Key; callers that retry should pass the same one.
export const sendMessage = (conversationId: string, body: string, idempotencyKey: string = crypto.randomUUID()) =>
  gatewayFetch<ChatMessage>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { content: body },
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const markRead = (conversationId: string) =>
  gatewayFetch<void>(`/conversations/${conversationId}/read`, { method: "POST" });
