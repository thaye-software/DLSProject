import { MongoServerError, type Collection, type Db, type Filter } from "mongodb";
import type { ConversationStore, MessagePage, NewConversation, NewMessage } from "../../application/ports/conversation-store.js";
import type { Conversation, Message, MessageCursor, Viewer } from "../../domain/chat.js";

const DUPLICATE_KEY = 11000;

type MessageDoc = {
  _id: string;
  conversation_id: string;
  sender_user_id: string;
  content: string;
  idempotency_key: string;
  created_at: Date;
};

type ConversationDoc = {
  _id: string;
  customer_user_id: string;
  customer_display_name: string;
  product_id: string;
  product_name: string;
  thumbnail_url: string | null;
  last_message: Omit<MessageDoc, "idempotency_key"> | null;
  customer_unread_count: number;
  shop_unread_count: number;
  customer_last_read_at: Date;
  shop_last_read_at: Date;
  created_at: Date;
  updated_at: Date;
};

export class MongoConversationStore implements ConversationStore {
  private readonly conversations: Collection<ConversationDoc>;
  private readonly messages: Collection<MessageDoc>;

  constructor(db: Db) {
    this.conversations = db.collection<ConversationDoc>("conversations");
    this.messages = db.collection<MessageDoc>("messages");
  }

  async ensureIndexes(): Promise<void> {
    await this.conversations.createIndex({ customer_user_id: 1, product_id: 1 }, { name: "customer_product", unique: true });
    await this.conversations.createIndex({ updated_at: -1 }, { name: "updated_at" });
    await this.messages.createIndex({ conversation_id: 1, created_at: -1, _id: -1 }, { name: "conversation_created_at" });
    await this.messages.createIndex(
      { conversation_id: 1, sender_user_id: 1, idempotency_key: 1 },
      { name: "conversation_sender_idempotency", unique: true },
    );
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    const doc = await this.conversations.findOne({ _id: conversationId });
    return doc ? toConversation(doc) : null;
  }

  async findByCustomerAndProduct(customerUserId: string, productId: string): Promise<Conversation | null> {
    const doc = await this.conversations.findOne({ customer_user_id: customerUserId, product_id: productId });
    return doc ? toConversation(doc) : null;
  }

  async listFor(viewer: Viewer): Promise<Conversation[]> {
    const filter: Filter<ConversationDoc> = viewer.isAdmin ? {} : { customer_user_id: viewer.userId };
    const docs = await this.conversations.find(filter).sort({ updated_at: -1 }).toArray();
    return docs.map(toConversation);
  }

  async insert(conversation: NewConversation): Promise<Conversation> {
    const doc: ConversationDoc = {
      _id: conversation.conversationId,
      customer_user_id: conversation.customerUserId,
      customer_display_name: conversation.customerDisplayName,
      product_id: conversation.productId,
      product_name: conversation.productName,
      thumbnail_url: conversation.thumbnailUrl,
      last_message: null,
      customer_unread_count: 0,
      shop_unread_count: 0,
      customer_last_read_at: conversation.now,
      shop_last_read_at: conversation.now,
      created_at: conversation.now,
      updated_at: conversation.now,
    };
    try {
      await this.conversations.insertOne(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw Object.assign(new Error("duplicate conversation"), { code: DUPLICATE_KEY });
      }
      throw error;
    }
    return toConversation(doc);
  }

  async findByIdempotencyKey(conversationId: string, senderUserId: string, idempotencyKey: string): Promise<Message | null> {
    const doc = await this.messages.findOne({
      conversation_id: conversationId,
      sender_user_id: senderUserId,
      idempotency_key: idempotencyKey,
    });
    return doc ? toMessage(doc) : null;
  }

  async insertMessage(message: NewMessage, increment: "customer" | "shop"): Promise<Message> {
    const doc: MessageDoc = {
      _id: message.messageId,
      conversation_id: message.conversationId,
      sender_user_id: message.senderUserId,
      content: message.content,
      idempotency_key: message.idempotencyKey,
      created_at: message.now,
    };
    try {
      await this.messages.insertOne(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw Object.assign(new Error("duplicate message"), { code: DUPLICATE_KEY });
      }
      throw error;
    }
    const unreadField = increment === "shop" ? "shop_unread_count" : "customer_unread_count";
    await this.conversations.updateOne(
      { _id: message.conversationId },
      { $set: { last_message: lastMessageEmbed(doc), updated_at: message.now }, $inc: { [unreadField]: 1 } },
    );
    return toMessage(doc);
  }

  async markRead(conversationId: string, viewer: "customer" | "shop", now: Date): Promise<void> {
    const unreadField = viewer === "customer" ? "customer_unread_count" : "shop_unread_count";
    const readField = viewer === "customer" ? "customer_last_read_at" : "shop_last_read_at";
    await this.conversations.updateOne({ _id: conversationId }, { $set: { [unreadField]: 0, [readField]: now } });
  }

  async anonymiseCustomer(userId: string, displayName: string): Promise<number> {
    const result = await this.conversations.updateMany({ customer_user_id: userId }, { $set: { customer_display_name: displayName } });
    return result.modifiedCount;
  }

  async listMessages(conversationId: string, limit: number, before: MessageCursor | null): Promise<MessagePage> {
    const filter: Filter<MessageDoc> = { conversation_id: conversationId };
    if (before) {
      filter.$or = [
        { created_at: { $lt: before.createdAt } },
        { created_at: before.createdAt, _id: { $lt: before.messageId } },
      ];
    }
    const docs = await this.messages.find(filter).sort({ created_at: -1, _id: -1 }).limit(limit + 1).toArray();
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const oldest = page.at(-1);
    return {
      items: page.map(toMessage).reverse(),
      nextCursor: hasMore && oldest ? { createdAt: oldest.created_at, messageId: oldest._id } : null,
    };
  }
}

function lastMessageEmbed(doc: MessageDoc) {
  return {
    _id: doc._id,
    conversation_id: doc.conversation_id,
    sender_user_id: doc.sender_user_id,
    content: doc.content,
    created_at: doc.created_at,
  };
}

function toMessage(doc: Pick<MessageDoc, "_id" | "conversation_id" | "sender_user_id" | "content" | "created_at">): Message {
  return {
    messageId: doc._id,
    conversationId: doc.conversation_id,
    senderUserId: doc.sender_user_id,
    content: doc.content,
    createdAt: doc.created_at,
  };
}

function toConversation(doc: ConversationDoc): Conversation {
  return {
    conversationId: doc._id,
    customerUserId: doc.customer_user_id,
    customerDisplayName: doc.customer_display_name,
    productId: doc.product_id,
    productName: doc.product_name,
    thumbnailUrl: doc.thumbnail_url,
    lastMessage: doc.last_message ? toMessage(doc.last_message) : null,
    customerUnreadCount: doc.customer_unread_count,
    shopUnreadCount: doc.shop_unread_count,
    customerLastReadAt: doc.customer_last_read_at,
    shopLastReadAt: doc.shop_last_read_at,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}
