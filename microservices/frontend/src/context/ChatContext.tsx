"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { listConversations } from "@/app/chat/actions";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import type { Conversation } from "@/services/conversationService";

type ChatContextType = {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  selectedConversation: Conversation | null;
  setSelectedConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useSupabaseAuthContext();
  const [chatOpen, setChatOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Load the customer's conversations each time the chat is opened.
  useEffect(() => {
    if (!chatOpen || !user) return;
    void listConversations().then((r) => (r.ok ? setConversations(r.data.items) : toast.error(r.error)));
  }, [chatOpen, user]);

  return (
    <ChatContext.Provider value={{ chatOpen, setChatOpen, conversations, setConversations, selectedConversation, setSelectedConversation }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
};
