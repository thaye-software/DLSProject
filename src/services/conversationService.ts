import { db } from "@/database/drizzle";
import { conversations } from "@/database/schema";
import { UUID } from "crypto";
import { desc, eq } from "drizzle-orm";

export const conversationService = {
  async getAllConversations() {
    const conversationsResult = await db.query.conversations.findMany({
      with: {
        messages: {
          with: {
            sender: true,
          },
          orderBy: [desc(conversations.createdAt)],
        },
        product: {
          with: {
            productImages: true,
            watch: true,
          },
        },
      },
    });
    return conversationsResult;
  },

  async getConversationsByCustomerId(customerId: string) {
    const conversationsResult = await db.query.conversations.findMany({
      where: eq(conversations.customerId, customerId),
      with: {
        messages: {
          with: {
            sender: true,
          },
          orderBy: [desc(conversations.createdAt)],
        },
        product: {
          with: {
            productImages: true,
            watch: true,
          },
        },
      },
    });
    return conversationsResult;
  },
};
