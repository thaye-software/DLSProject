"use server";

import { db } from "@/database/drizzle";
import { conversations } from "@/database/schema";
import { and, desc, eq, or } from "drizzle-orm";

export async function getConversations(userId: string, role: string) {
  let conversationsResult;

  if (role === "admin") {
    conversationsResult = await getAllConversations();
  } else {
    conversationsResult = await getConversationsByCustomerId(userId);
  }
  return conversationsResult;
}

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

export async function createConversation(
  customerId: string,
  productId: string
) {
  const existingConversation = await checkConversationExists(
    customerId,
    productId
  );
  if (existingConversation) {
    return existingConversation;
  }

  // Insert the conversation, then fetch the complete record (with relations)
  await db.insert(conversations).values({
    customerId,
    productId,
    status: "open",
  });

  // Return the conversation with messages and product loaded
  const created = await checkConversationExists(customerId, productId);
  return created;
}

// Helper function to check for existing conversation
// If a conversation exists between the customer and product, just return that, with product and messages loaded
async function checkConversationExists(customerId: string, productId: string) {
  const existingConversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.customerId, customerId),
      eq(conversations.productId, productId)
    ),
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
  return existingConversation;
}
