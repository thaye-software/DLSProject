import { describe, expect, it } from "vitest";
import { InMemoryConversationStore } from "../../src/adapters/memory/in-memory-conversation-store.js";
import { onUserDeleted } from "../../src/application/anonymise-user.js";
import type { Inbox } from "../../src/application/ports/inbox.js";
import { CONVERSATION_ID, customer, EVENT_ID, NOW, PRODUCT_ID, product } from "../fixtures/chat.js";

class MemoryInbox implements Inbox {
  readonly ids = new Set<string>();
  async has(eventId: string) {
    return this.ids.has(eventId);
  }
  async record(eventId: string) {
    this.ids.add(eventId);
  }
}

describe("onUserDeleted", () => {
  it("renames the customer's display name and keeps the conversation", async () => {
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
    const inbox = new MemoryInbox();

    await expect(onUserDeleted(customer.userId, EVENT_ID, { store, inbox })).resolves.toEqual({
      kind: "applied",
      conversations: 1,
    });
    expect((await store.findById(CONVERSATION_ID))?.customerDisplayName).toBe("Deleted User");
    expect((await store.findById(CONVERSATION_ID))?.customerUserId).toBe(customer.userId);
  });

  it("skips a CloudEvent id it has already handled", async () => {
    const inbox = new MemoryInbox();
    await inbox.record(EVENT_ID);

    await expect(
      onUserDeleted(customer.userId, EVENT_ID, { store: new InMemoryConversationStore(), inbox }),
    ).resolves.toEqual({ kind: "duplicate" });
  });
});
