"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

import { listConversations } from "@/app/chat/actions";
import type { Conversation } from "@/services/conversationService";

const POLL_MS = 10_000;

type InboxContextType = {
  conversations: Conversation[];
  totalUnread: number;
  refresh: () => Promise<void>;
};

const UnreadMessagesContext = createContext<InboxContextType | undefined>(undefined);

// Admin inbox: polls the conversation list (also feeds the sidebar badge on every admin page).
export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await listConversations();
      if (r.ok) setConversations(r.data.items);
      else console.error("Inbox refresh failed:", r.error);
    } catch (e) {
      console.error("Inbox refresh failed:", e);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <UnreadMessagesContext.Provider value={{ conversations, totalUnread, refresh }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessagesContext() {
  const context = useContext(UnreadMessagesContext);
  if (!context) {
    throw new Error("useUnreadMessagesContext must be used within a UnreadMessagesProvider");
  }
  return context;
}
