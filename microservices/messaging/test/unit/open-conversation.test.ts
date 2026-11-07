import { describe, expect, it, vi } from "vitest";
import { InMemoryConversationStore } from "../../src/adapters/memory/in-memory-conversation-store.js";
import { openConversation } from "../../src/application/open-conversation.js";
import type { CatalogClient } from "../../src/application/ports/catalog-client.js";
import { admin, CONVERSATION_ID, customer, NOW, PRODUCT_ID, product } from "../fixtures/chat.js";

function catalogReturning(kind: "found" | "not_found" | "unavailable"): CatalogClient {
  return {
    getProduct: vi.fn(async () => (kind === "found" ? { kind, product } : { kind })),
  };
}

describe("openConversation", () => {
  it("creates a conversation after Catalog confirms the product", async () => {
    const store = new InMemoryConversationStore();
    const catalog = catalogReturning("found");

    const result = await openConversation(customer, PRODUCT_ID, {
      store,
      catalog,
      now: () => NOW,
      newId: () => CONVERSATION_ID,
    });

    expect(result).toMatchObject({
      outcome: "created",
      conversation: {
        conversationId: CONVERSATION_ID,
        customerUserId: customer.userId,
        customerDisplayName: "mette",
        productId: PRODUCT_ID,
        productName: product.name,
      },
    });
    expect(catalog.getProduct).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("returns the existing conversation without calling Catalog", async () => {
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
    const catalog = catalogReturning("found");

    const result = await openConversation(customer, PRODUCT_ID, {
      store,
      catalog,
      now: () => NOW,
      newId: () => "11111111-1111-4111-8111-111111111111",
    });

    expect(result.outcome).toBe("existing");
    expect(catalog.getProduct).not.toHaveBeenCalled();
  });

  it("rejects an admin", async () => {
    const catalog = catalogReturning("found");

    await expect(
      openConversation(admin, PRODUCT_ID, {
        store: new InMemoryConversationStore(),
        catalog,
        now: () => NOW,
        newId: () => CONVERSATION_ID,
      }),
    ).resolves.toEqual({ outcome: "forbidden" });
    expect(catalog.getProduct).not.toHaveBeenCalled();
  });

  it.each([
    { name: "unknown product", kind: "not_found" as const, outcome: "product_not_found" },
    { name: "Catalog down", kind: "unavailable" as const, outcome: "catalog_unavailable" },
  ])("answers $outcome when $name", async ({ kind, outcome }) => {
    await expect(
      openConversation(customer, PRODUCT_ID, {
        store: new InMemoryConversationStore(),
        catalog: catalogReturning(kind),
        now: () => NOW,
        newId: () => CONVERSATION_ID,
      }),
    ).resolves.toEqual({ outcome });
  });
});
