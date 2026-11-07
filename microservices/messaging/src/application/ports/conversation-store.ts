import type { Conversation, Message, MessageCursor, Viewer } from "../../domain/chat.js";

export type NewConversation = {
  conversationId: string;
  customerUserId: string;
  customerDisplayName: string;
  productId: string;
  productName: string;
  thumbnailUrl: string | null;
  now: Date;
};

export type NewMessage = {
  messageId: string;
  conversationId: string;
  senderUserId: string;
  content: string;
  idempotencyKey: string;
  now: Date;
};

export type MessagePage = {
  items: Message[];
  nextCursor: MessageCursor | null;
};

export type ConversationStore = {
  findById(conversationId: string): Promise<Conversation | null>;
  findByCustomerAndProduct(customerUserId: string, productId: string): Promise<Conversation | null>;
  listFor(viewer: Viewer): Promise<Conversation[]>;
  insert(conversation: NewConversation): Promise<Conversation>;
  findByIdempotencyKey(conversationId: string, senderUserId: string, idempotencyKey: string): Promise<Message | null>;
  insertMessage(message: NewMessage, increment: "customer" | "shop"): Promise<Message>;
  markRead(conversationId: string, viewer: "customer" | "shop", now: Date): Promise<void>;
  anonymiseCustomer(userId: string, displayName: string): Promise<number>;
  listMessages(conversationId: string, limit: number, before: MessageCursor | null): Promise<MessagePage>;
};
