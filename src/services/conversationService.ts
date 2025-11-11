import { db } from "@/database/drizzle";
import { conversations } from "@/database/schema";
import { eq } from "drizzle-orm";

export const conversationService = {
  async getConversationsByCustomerId(customerId: number) {
    const conversationsResult = await db.query.conversations.findMany({
      where: eq(conversations.customerId, customerId),
      with: {
        messages: {
          with: {
            sender: true,
          },
        },
        product: true,
      },
    });
    return conversationsResult;
  },
};
