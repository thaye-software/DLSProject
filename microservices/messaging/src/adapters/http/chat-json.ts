import { z } from "zod";
import {
  decodeCursor,
  DEFAULT_MESSAGE_LIMIT,
  encodeCursor,
  MAX_CONTENT_LENGTH,
  MAX_MESSAGE_LIMIT,
  unreadFor,
  type Conversation,
  type Message,
  type MessageCursor,
  type Viewer,
} from "../../domain/chat.js";

export const openConversationRequestSchema = z.strictObject({
  product_id: z.uuid(),
});

export const sendMessageRequestSchema = z.strictObject({
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
});

export const listMessagesQuerySchema = z.object({
  before: z
    .string()
    .min(1)
    .optional()
    .transform((value, context) => {
      if (value === undefined) return null;
      const cursor = decodeCursor(value);
      if (!cursor) {
        context.addIssue({ code: "custom", message: "before must be a message cursor" });
        return z.NEVER;
      }
      return cursor;
    }),
  limit: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === "" ? DEFAULT_MESSAGE_LIMIT : Number(value)))
    .pipe(z.number().int().min(1).max(MAX_MESSAGE_LIMIT)),
});

export function messageJson(message: Message) {
  return {
    message_id: message.messageId,
    conversation_id: message.conversationId,
    sender_user_id: message.senderUserId,
    content: message.content,
    created_at: message.createdAt.toISOString(),
  };
}

export function conversationJson(conversation: Conversation, viewer: Viewer) {
  return {
    conversation_id: conversation.conversationId,
    customer_user_id: conversation.customerUserId,
    customer_display_name: conversation.customerDisplayName,
    product_id: conversation.productId,
    product_name: conversation.productName,
    thumbnail_url: conversation.thumbnailUrl,
    last_message: conversation.lastMessage ? messageJson(conversation.lastMessage) : null,
    unread_count: unreadFor(viewer, conversation),
    created_at: conversation.createdAt.toISOString(),
    updated_at: conversation.updatedAt.toISOString(),
  };
}

export function messagePageJson(items: Message[], nextCursor: MessageCursor | null) {
  return {
    items: items.map(messageJson),
    next_cursor: nextCursor ? encodeCursor(nextCursor) : null,
  };
}
