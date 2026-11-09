import React, { createContext, use, useContext, useEffect, useState } from "react";
import { useSupabaseAuthContext } from "./SupabaseAuthContext";
import { getAllConversations, getConversationsByCustomerId } from "@/services/conversationService";

type ChatContextType = {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  conversations: any[];
  setConversations: React.Dispatch<React.SetStateAction<any[]>>;
  selectedConversation: any;
  setSelectedConversation: React.Dispatch<React.SetStateAction<any>>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);

  const { user, role } = useSupabaseAuthContext();

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      if (role === "admin") {
        const conversations = await getAllConversations();
        setConversations(conversations);
      } else {
        const conversations = await getConversationsByCustomerId(user.id);
        setConversations(conversations);
      }
      };
      fetchConversations();
  }, [user, role]);
  

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
