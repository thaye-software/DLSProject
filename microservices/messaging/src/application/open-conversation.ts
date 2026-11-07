import { canAccess, displayNameFromEmail, type Conversation, type Viewer } from "../domain/chat.js";
import type { CatalogClient } from "./ports/catalog-client.js";
import type { ConversationStore } from "./ports/conversation-store.js";

export type OpenConversationResult =
  | { outcome: "created" | "existing"; conversation: Conversation }
  | { outcome: "forbidden" }
  | { outcome: "product_not_found" }
  | { outcome: "catalog_unavailable" };

export type OpenConversationDependencies = {
  store: ConversationStore;
  catalog: CatalogClient;
  now: () => Date;
  newId: () => string;
};

export async function openConversation(
  viewer: Viewer,
  productId: string,
  { store, catalog, now, newId }: OpenConversationDependencies,
): Promise<OpenConversationResult> {
  if (viewer.isAdmin) return { outcome: "forbidden" };

  const existing = await store.findByCustomerAndProduct(viewer.userId, productId);
  if (existing && canAccess(viewer, existing)) return { outcome: "existing", conversation: existing };

  const lookup = await catalog.getProduct(productId);
  if (lookup.kind === "not_found") return { outcome: "product_not_found" };
  if (lookup.kind === "unavailable") return { outcome: "catalog_unavailable" };

  try {
    const conversation = await store.insert({
      conversationId: newId(),
      customerUserId: viewer.userId,
      customerDisplayName: displayNameFromEmail(viewer.email),
      productId,
      productName: lookup.product.name,
      thumbnailUrl: lookup.product.thumbnailUrl,
      now: now(),
    });
    return { outcome: "created", conversation };
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const raced = await store.findByCustomerAndProduct(viewer.userId, productId);
    if (!raced) throw error;
    return { outcome: "existing", conversation: raced };
  }
}

function isDuplicate(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}
