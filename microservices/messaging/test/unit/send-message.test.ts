import { describe, expect, it, vi } from "vitest";
import { InMemoryConversationStore } from "../../src/adapters/memory/in-memory-conversation-store.js";
import { messageIdFor, sendMessage } from "../../src/application/send-message.js";
import type { ChatBroadcaster } from "../../src/application/ports/chat-broadcaster.js";
import { admin, CONVERSATION_ID, customer, IDEMPOTENCY_KEY, NOW, PRODUCT_ID, product, stranger } from "../fixtures/chat.js";

const later = new Date("2026-10-15T10:01:00.000Z");
const otherKey = "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a";

async function storeWithConversation() {
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
  return store;
}

const deps = (store: InMemoryConversationStore, broadcaster: ChatBroadcaster = { messageCreated: async () => undefined }) => ({
  store,
  broadcaster,
  now: () => later,
});

describe("sendMessage", () => {
  it("persists then broadcasts, and counts the message as unread for the shop", async () => {
    const store = await storeWithConversation();
    const broadcaster: ChatBroadcaster = { messageCreated: vi.fn(async () => undefined) };

    const result = await sendMessage(customer, CONVERSATION_ID, "Is this watch still available?", IDEMPOTENCY_KEY, deps(store, broadcaster));

    expect(result.outcome).toBe("sent");
    if (result.outcome !== "sent" && result.outcome !== "replayed") return;
    expect(result.message.content).toBe("Is this watch still available?");
    expect(result.message.messageId).toBe(messageIdFor(CONVERSATION_ID, customer.userId, IDEMPOTENCY_KEY));
    expect(broadcaster.messageCreated).toHaveBeenCalledWith(result.message);
    expect((await store.findById(CONVERSATION_ID))?.shopUnreadCount).toBe(1);
    expect((await store.findById(CONVERSATION_ID))?.customerUnreadCount).toBe(0);
  });

  it("returns the first message for a repeated Idempotency-Key without broadcasting again", async () => {
    const store = await storeWithConversation();
    const broadcaster: ChatBroadcaster = { messageCreated: vi.fn(async () => undefined) };

    const first = await sendMessage(customer, CONVERSATION_ID, "Hello", IDEMPOTENCY_KEY, deps(store, broadcaster));
    const second = await sendMessage(customer, CONVERSATION_ID, "Hello again", IDEMPOTENCY_KEY, deps(store, broadcaster));

    expect(first.outcome).toBe("sent");
    expect(second.outcome).toBe("replayed");
    if (first.outcome === "sent" && second.outcome === "replayed") {
      expect(second.message).toEqual(first.message);
    }
    expect(broadcaster.messageCreated).toHaveBeenCalledTimes(1);
    expect((await store.listMessages(CONVERSATION_ID, 10, null)).items).toHaveLength(1);
    expect((await store.findById(CONVERSATION_ID))?.shopUnreadCount).toBe(1);
  });

  it("treats a new Idempotency-Key as a new message", async () => {
    const store = await storeWithConversation();

    await sendMessage(customer, CONVERSATION_ID, "First", IDEMPOTENCY_KEY, deps(store));
    const second = await sendMessage(customer, CONVERSATION_ID, "Second", otherKey, deps(store));

    expect(second.outcome).toBe("sent");
    expect((await store.listMessages(CONVERSATION_ID, 10, null)).items).toHaveLength(2);
  });

  it("still returns sent when Realtime fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = await storeWithConversation();
    const broadcaster: ChatBroadcaster = {
      messageCreated: vi.fn(async () => {
        throw new Error("realtime down");
      }),
    };

    const result = await sendMessage(customer, CONVERSATION_ID, "Hello", IDEMPOTENCY_KEY, deps(store, broadcaster));

    expect(result.outcome).toBe("sent");
    expect((await store.listMessages(CONVERSATION_ID, 10, null)).items).toHaveLength(1);
  });

  it("lets an admin reply and counts unread for the customer", async () => {
    const store = await storeWithConversation();

    const result = await sendMessage(admin, CONVERSATION_ID, "Yes, it is.", IDEMPOTENCY_KEY, deps(store));

    expect(result.outcome).toBe("sent");
    expect((await store.findById(CONVERSATION_ID))?.customerUnreadCount).toBe(1);
  });

  it("forbids a stranger", async () => {
    const store = await storeWithConversation();

    await expect(sendMessage(stranger, CONVERSATION_ID, "Hi", IDEMPOTENCY_KEY, deps(store))).resolves.toEqual({
      outcome: "forbidden",
    });
  });

  it("answers not_found for an unknown conversation", async () => {
    await expect(
      sendMessage(customer, CONVERSATION_ID, "Hi", IDEMPOTENCY_KEY, deps(new InMemoryConversationStore())),
    ).resolves.toEqual({ outcome: "not_found" });
  });
});
