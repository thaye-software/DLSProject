"use server";

import { db } from "@/database/drizzle";
import { messages } from "@/database/schema";
import { ChatMessage } from "@/hooks/use-realtime-chat";

export type PersistableMessage = {
  conversationId: number;
  senderId: string;
  senderType: "customer" | "seller";
  content: string;
  isRead?: boolean;
  createdAt?: string | Date;
};

export async function persistMessage(message: PersistableMessage) {
  // ensure types align with the DB schema
  const insertResult = await db.insert(messages).values({
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderType: message.senderType,
    content: message.content,
    isRead: message.isRead ?? false,
    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
  });
  return insertResult;
}