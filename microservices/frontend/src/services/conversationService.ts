"use server";

import { db } from "@/database/drizzle";
import { conversations } from "@/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { ConversationModel, NewConversationModel, ProductModel } from "@/database/types";

export async function getConversations(userId: string, role: string): Promise<ConversationModel[]> {
  try {
    let conversationsResult;
    
    if (role === "admin") {
      conversationsResult = await getAllConversations();
    } else {
      conversationsResult = await getConversationsByCustomerId(userId);
    }
      return conversationsResult;
  } catch (error) {
    console.error(`(server) failed to get conversations for userId: ${userId} with role: ${role}`, error);
    throw error;
  }
}

export async function getAllConversations(): Promise<ConversationModel[]> {
  try {
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
            watch: {
              with: {
                brand: true,
              }
            },
          },
        },
      },
    });
    return conversationsResult;
  } catch (error) {
    console.error("(server) failed to get all conversations", error);
    throw error;
  }
}

export async function getConversationsByCustomerId(customerId: string): Promise<ConversationModel[]> {
  try {
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
          watch: {
            with: {
              brand: true,
            },
          },
        },
      },
    },
  });
    return conversationsResult;
  } catch (error) {
    console.error(`(server) failed to get conversations for customerId: ${customerId}`, error);
    throw error;
  }
}

export async function createConversation(newConversation: NewConversationModel): Promise<ConversationModel | null> {
  try {
  const existingConversation = await checkConversationExists(
    newConversation.customerId,
    newConversation.productId
  );
  if (existingConversation) {
    return existingConversation;
  }

  // Insert the conversation, then fetch the complete record (with relations)
  await db.insert(conversations).values({
    customerId: newConversation.customerId,
    productId: newConversation.productId,
    status: "open",
  });

  // Return the conversation with messages and product loaded
  const created = await checkConversationExists(newConversation.customerId, newConversation.productId);
    return created;
  } catch (error) {
    console.error("(server) failed to create conversation", error);
    throw error;
  }
}

// Helper function to check for existing conversation
// If a conversation exists between the customer and product, just return that, with product and messages loaded
async function checkConversationExists(customerId: string, productId: string): Promise<ConversationModel | null> {
  try {
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
          watch: {
            with: {
              brand: true,
            },
          },
        },
      },
    },
  });
  if (!existingConversation) {
    return null;
  }
    return existingConversation;
  } catch (error) {
    console.error("(server) failed to check if conversation exists", error);
    throw error;
  }
}
