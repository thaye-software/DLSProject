"use client";

import { Button } from "../ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";

import { ChatPanel } from "./ChatPanel";

import { useChatContext } from "@/context/ChatContext";

export default function ChatBox() {
  const {
    setChatOpen,
    conversations,
    selectedConversation,
    setSelectedConversation
  } = useChatContext();

  function handleBackButton() {
    setSelectedConversation(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-24 right-6 z-50 w-[400px] max-w-full h-[480px] rounded-lg bg-card shadow-xl overflow-hidden flex flex-col"
    >
      <div className="sticky top-0 z-30 bg-card flex items-center justify-between p-2 border-b border-border">
        {selectedConversation ? (
          <div className="flex items-center justify-between w-full">
            <div>
              <Button
                onClick={() => handleBackButton()}
                size="icon"
                variant="ghost"
              >
                <ArrowLeft className="h-5 w-5 transition-transform transform group-hover:-translate-x-1" />
              </Button>
            </div>
            <div className="font-bold justify-start">
              <h1>{selectedConversation.product.name}</h1>
            </div>
            <div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setChatOpen(false)}
                className="text-sm text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="font-semibold ml-2">Chat</div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setChatOpen(false)}
              className="text-sm text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        <ChatPanel
          conversations={conversations}
          selectedConversation={selectedConversation}
          setSelectedConversation={setSelectedConversation}
        />
      </div>
    </motion.div>
  );
}
