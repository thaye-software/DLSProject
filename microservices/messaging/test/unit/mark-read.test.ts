import { describe, expect, it } from "vitest";
import { InMemoryConversationStore } from "../../src/adapters/memory/in-memory-conversation-store.js";
import { markRead } from "../../src/application/mark-read.js";
import { sendMessage } from "../../src/application/send-message.js";
import { admin, CONVERSATION_ID, customer, IDEMPOTENCY_KEY, NOW, PRODUCT_ID, product, stranger } from "../fixtures/chat.js";

const later = new Date("2026-10-15T10:02:00.000Z");

async function storeWithUnreadShop() {
  const store = new InMemoryConversationStore();
  await store.insert({
    conversationId: CONVERSATION_ID,
    customerUserId: customer.userId,
    customerDisplayName: "mette",
    productId: PRODUCT_ID,
    productName: product.name,
    thumbnailUrl: product.thumbnailUrl,
    now: NOW,
  });
  await sendMessage(customer, CONVERSATION_ID, "Hello", IDEMPOTENCY_KEY, {
    store,
    broadcaster: { messageCreated: async () => undefined },
    now: () => new Date("2026-10-15T10:01:00.000Z"),
  });
  return store;
}

describe("markRead", () => {
  it("clears the shop unread count for an admin", async () => {
    const store = await storeWithUnreadShop();

    await expect(markRead(admin, CONVERSATION_ID, store, () => later)).resolves.toEqual({ outcome: "read" });
    expect((await store.findById(CONVERSATION_ID))?.shopUnreadCount).toBe(0);
    expect((await store.findById(CONVERSATION_ID))?.shopLastReadAt).toEqual(later);
  });

  it("forbids a stranger", async () => {
    const store = await storeWithUnreadShop();

    await expect(markRead(stranger, CONVERSATION_ID, store, () => later)).resolves.toEqual({ outcome: "forbidden" });
  });
});
