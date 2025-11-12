import { db } from "@/database/drizzle";
import { conversations } from "@/database/schema";
import { UUID } from "crypto";
import { desc, eq } from "drizzle-orm";

export async function getAllConversations() {
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
}

export async function getConversationsByCustomerId(customerId: string) {
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
}