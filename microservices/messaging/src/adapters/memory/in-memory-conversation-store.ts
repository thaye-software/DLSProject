import type { ConversationStore, MessagePage, NewConversation, NewMessage } from "../../application/ports/conversation-store.js";
import type { Conversation, Message, MessageCursor, Viewer } from "../../domain/chat.js";

const DUPLICATE_KEY = 11000;

type StoredMessage = Message & { idempotencyKey: string };

export class InMemoryConversationStore implements ConversationStore {
  readonly conversations = new Map<string, Conversation>();
  readonly messages: StoredMessage[] = [];

  async findById(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) ?? null;
  }

  async findByCustomerAndProduct(customerUserId: string, productId: string): Promise<Conversation | null> {
    return [...this.conversations.values()].find((conversation) => conversation.customerUserId === customerUserId && conversation.productId === productId) ?? null;
  }

  async listFor(viewer: Viewer): Promise<Conversation[]> {
    const items = [...this.conversations.values()].filter((conversation) => viewer.isAdmin || conversation.customerUserId === viewer.userId);
    return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.conversationId.localeCompare(a.conversationId));
  }

  async insert(conversation: NewConversation): Promise<Conversation> {
    const existing = await this.findByCustomerAndProduct(conversation.customerUserId, conversation.productId);
    if (existing) throw Object.assign(new Error("duplicate conversation"), { code: DUPLICATE_KEY });
    const created: Conversation = {
      conversationId: conversation.conversationId,
      customerUserId: conversation.customerUserId,
      customerDisplayName: conversation.customerDisplayName,
      productId: conversation.productId,
      productName: conversation.productName,
      thumbnailUrl: conversation.thumbnailUrl,
      lastMessage: null,
      customerUnreadCount: 0,
      shopUnreadCount: 0,
      customerLastReadAt: conversation.now,
      shopLastReadAt: conversation.now,
      createdAt: conversation.now,
      updatedAt: conversation.now,
    };
    this.conversations.set(created.conversationId, created);
    return created;
  }

  async findByIdempotencyKey(conversationId: string, senderUserId: string, idempotencyKey: string): Promise<Message | null> {
    return this.messages.find(
      (message) =>
        message.conversationId === conversationId && message.senderUserId === senderUserId && message.idempotencyKey === idempotencyKey,
    ) ?? null;
  }

  async insertMessage(message: NewMessage, increment: "customer" | "shop"): Promise<Message> {
    const conversation = this.conversations.get(message.conversationId);
    if (!conversation) throw new Error(`conversation ${message.conversationId} is missing`);
    if (await this.findByIdempotencyKey(message.conversationId, message.senderUserId, message.idempotencyKey)) {
      throw Object.assign(new Error("duplicate message"), { code: DUPLICATE_KEY });
    }
    const stored: StoredMessage = {
      messageId: message.messageId,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      content: message.content,
      createdAt: message.now,
      idempotencyKey: message.idempotencyKey,
    };
    this.messages.push(stored);
    this.conversations.set(message.conversationId, {
      ...conversation,
      lastMessage: stored,
      updatedAt: message.now,
      customerUnreadCount: conversation.customerUnreadCount + (increment === "customer" ? 1 : 0),
      shopUnreadCount: conversation.shopUnreadCount + (increment === "shop" ? 1 : 0),
    });
    return stored;
  }

  async markRead(conversationId: string, viewer: "customer" | "shop", now: Date): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    this.conversations.set(conversationId, {
      ...conversation,
      customerUnreadCount: viewer === "customer" ? 0 : conversation.customerUnreadCount,
      shopUnreadCount: viewer === "shop" ? 0 : conversation.shopUnreadCount,
      customerLastReadAt: viewer === "customer" ? now : conversation.customerLastReadAt,
      shopLastReadAt: viewer === "shop" ? now : conversation.shopLastReadAt,
    });
  }

  async anonymiseCustomer(userId: string, displayName: string): Promise<number> {
    let count = 0;
    for (const conversation of this.conversations.values()) {
      if (conversation.customerUserId !== userId || conversation.customerDisplayName === displayName) continue;
      this.conversations.set(conversation.conversationId, { ...conversation, customerDisplayName: displayName });
      count += 1;
    }
    return count;
  }

  async listMessages(conversationId: string, limit: number, before: MessageCursor | null): Promise<MessagePage> {
    const ordered = this.messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.messageId.localeCompare(a.messageId));
    const afterCursor = before
      ? ordered.filter((message) => message.createdAt.getTime() < before.createdAt.getTime() || (message.createdAt.getTime() === before.createdAt.getTime() && message.messageId < before.messageId))
      : ordered;
    const hasMore = afterCursor.length > limit;
    const page = afterCursor.slice(0, limit);
    const oldest = page.at(-1);
    return {
      items: [...page].reverse(),
      nextCursor: hasMore && oldest ? { createdAt: oldest.createdAt, messageId: oldest.messageId } : null,
    };
  }
}
