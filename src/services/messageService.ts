"use server";

import { db } from "@/database/drizzle";
import { messages } from "@/database/schema";
import { ChatMessage } from "@/hooks/use-realtime-chat";
import { and, eq, ne } from "drizzle-orm";

export type PersistableMessage = {
  conversationId: string;
  senderId: string;
  senderType: "customer" | "seller";
  content: string;
  isRead?: boolean;
  createdAt?: string | Date;
};

export async function persistMessage(message: PersistableMessage) {
  // ensure types align with the DB schema
  console.log("Persisting message:", message);
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

export async function markAsRead(
  conversationId: string,
  userId: string
) {
  console.log("Marking messages as read for conversation:", conversationId, "and user:", userId);
  try {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and( eq(messages.conversationId, conversationId), ne(messages.senderId, userId), eq(messages.isRead, false) )
      );
  } catch (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
}