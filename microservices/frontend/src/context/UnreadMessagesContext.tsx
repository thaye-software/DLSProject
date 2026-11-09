"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ChatMessage } from "@/hooks/useRealtimeChat";

type UnreadMessagesContextType = {
  unreadCounts: Record<string, number>;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  // New additions:
  realtimeMessages: Record<string, ChatMessage[]>;
  addRealtimeMessage: (conversationId: string, message: ChatMessage) => void;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined);

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [realtimeMessages, setRealtimeMessages] = useState<Record<string, ChatMessage[]>>({});

  const addRealtimeMessage = (conversationId: string, message: ChatMessage) => {
    setRealtimeMessages((prev) => {
      const currentList = prev[conversationId] || [];
      // Deduplicate: Don't add if ID already exists
      if (currentList.some((m) => m.id === message.id)) return prev;
      
      return {
        ...prev,
        [conversationId]: [...currentList, message],
      };
    });
  };

  return (
    <UnreadMessagesContext.Provider
      value={{
        unreadCounts,
        setUnreadCounts,
        realtimeMessages,
        addRealtimeMessage,
      }}
    >
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