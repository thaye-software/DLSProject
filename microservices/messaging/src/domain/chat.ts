export type Viewer = {
  userId: string;
  isAdmin: boolean;
  email: string | null;
};

export type Message = {
  messageId: string;
  conversationId: string;
  senderUserId: string;
  content: string;
  createdAt: Date;
};

export type Conversation = {
  conversationId: string;
  customerUserId: string;
  customerDisplayName: string;
  productId: string;
  productName: string;
  thumbnailUrl: string | null;
  lastMessage: Message | null;
  customerUnreadCount: number;
  shopUnreadCount: number;
  customerLastReadAt: Date;
  shopLastReadAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageCursor = {
  createdAt: Date;
  messageId: string;
};

export const MAX_CONTENT_LENGTH = 2000;
export const DEFAULT_MESSAGE_LIMIT = 50;
export const MAX_MESSAGE_LIMIT = 100;
export const DELETED_DISPLAY_NAME = "Deleted User";

export function displayNameFromEmail(email: string | null): string {
  const local = email?.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "Customer";
}

export function canAccess(viewer: Viewer, conversation: Conversation): boolean {
  return viewer.isAdmin || conversation.customerUserId === viewer.userId;
}

export function unreadFor(viewer: Viewer, conversation: Conversation): number {
  return viewer.isAdmin ? conversation.shopUnreadCount : conversation.customerUnreadCount;
}

export function encodeCursor(cursor: MessageCursor): string {
  return `${cursor.createdAt.toISOString()}_${cursor.messageId}`;
}

export function decodeCursor(value: string): MessageCursor | null {
  const separator = value.lastIndexOf("_");
  if (separator <= 0) return null;
  const createdAt = new Date(value.slice(0, separator));
  const messageId = value.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || messageId.length === 0) return null;
  return { createdAt, messageId };
}
