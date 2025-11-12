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

// export const messageService = {
//   async persistMessage(message: PersistableMessage) {
//     // ensure types align with the DB schema
//     const insertResult = await db.insert(messages).values({
//       conversationId: message.conversationId,
//       senderId: message.senderId,
//       senderType: message.senderType,
//       content: message.content,
//       isRead: message.isRead ?? false,
//       createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
//     });
//     return insertResult;
//   },

//   // helper to persist from a ChatMessage (the hook's type)
//   async persistFromChatMessage(message: Omit<ChatMessage, "id">) {
//     if (message.conversationId == null || message.senderId == null) {
//       throw new Error("Missing conversationId or senderId");
//     }
//     return this.persistMessage({
//       conversationId: message.conversationId,
//       senderId: message.senderId,
//       senderType: message.senderType ?? "customer",
//       content: message.content,
//       isRead: message.isRead,
//       createdAt: message.createdAt,
//     });
//   },
// };
