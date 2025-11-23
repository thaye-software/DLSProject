"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface UnreadMessagesContextType {
  unreadCounts: Record<string, number>;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined);

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  return (
    <UnreadMessagesContext.Provider value={{ unreadCounts, setUnreadCounts }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessagesContext() {
  const context = useContext(UnreadMessagesContext);
  if (context === undefined) {
    throw new Error("useUnreadMessages must be used within UnreadMessagesProvider");
  }
  return context;
}