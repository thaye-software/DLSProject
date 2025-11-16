import React, { createContext, useContext, useState } from "react";

type ChatContextType = {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  initialConversation?: any;
  setInitialConversation: React.Dispatch<React.SetStateAction<any>>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [initialConversation, setInitialConversation] = useState<any>(null);

  return (
    <ChatContext.Provider value={{ chatOpen, setChatOpen, initialConversation, setInitialConversation }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
};
