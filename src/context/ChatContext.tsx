import React, { createContext, useContext, useState } from "react";

type ChatContextType = {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  initialRoom?: any;
  setInitialRoom: React.Dispatch<React.SetStateAction<any>>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [initialRoom, setInitialRoom] = useState<any>(undefined);
  return (
    <ChatContext.Provider value={{ chatOpen, setChatOpen, initialRoom, setInitialRoom }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
};
