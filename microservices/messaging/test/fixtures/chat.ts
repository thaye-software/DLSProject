import type { Conversation, Message, Viewer } from "../../src/domain/chat.js";

export const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
export const ADMIN_ID = "0c5e1f2a-3b4d-4e6f-8a9b-1c2d3e4f5a6b";
export const OTHER_USER_ID = "5e0c7a1b-3f2d-4c6e-9b8a-1d2e3f4a5b6c";
export const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
export const CONVERSATION_ID = "3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a6b7";
export const MESSAGE_ID = "7a8b9c0d-1e2f-4a3b-8c9d-0e1f2a3b4c5d";
export const IDEMPOTENCY_KEY = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";
export const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
export const NOW = new Date("2026-10-15T10:00:00.000Z");

export const customer: Viewer = { userId: USER_ID, isAdmin: false, email: "mette@example.com" };
export const admin: Viewer = { userId: ADMIN_ID, isAdmin: true, email: "shop@limitedwatches.dk" };
export const stranger: Viewer = { userId: OTHER_USER_ID, isAdmin: false, email: "lars@example.com" };

export function message(overrides: Partial<Message> = {}): Message {
  return {
    messageId: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    senderUserId: USER_ID,
    content: "Is this watch still available?",
    createdAt: new Date("2026-10-15T10:01:00.000Z"),
    ...overrides,
  };
}

export function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: CONVERSATION_ID,
    customerUserId: USER_ID,
    customerDisplayName: "mette",
    productId: PRODUCT_ID,
    productName: "Rolex Submariner Date 126610LN",
    thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
    lastMessage: null,
    customerUnreadCount: 0,
    shopUnreadCount: 0,
    customerLastReadAt: NOW,
    shopLastReadAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export const product = {
  productId: PRODUCT_ID,
  name: "Rolex Submariner Date 126610LN",
  thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
};
