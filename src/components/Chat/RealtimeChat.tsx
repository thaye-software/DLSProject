"use client";

import { cn } from "@/lib/tailwindUtils";
import { ChatMessageItem } from "@/components/Chat/ChatMessage";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { type ChatMessage, useRealtimeChat } from "@/hooks/use-realtime-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { markAsRead } from "@/services/messageService";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { OfferPricePopover } from "./OfferPricePopover";

interface RealtimeChatProps {
  conversation: any;
  userId: string;
  username: string;
  onMessage?: (messages: ChatMessage[]) => void;
  // New prop to bubble up single messages to dashboard
  onMessageReceived?: (message: ChatMessage) => void;
  messages?: ChatMessage[];
}

export const RealtimeChat = ({
  conversation,
  userId,
  username,
  onMessage,
  onMessageReceived,
  messages: initialMessages = [],
}: RealtimeChatProps) => {
  const {
    containerRef,
    scrollToBottom,
    autoScrollEnabled,
    setAutoScrollEnabled,
  } = useChatScroll();

  const {
    messages: realtimeMessages,
    sendMessage,
    isConnected,
  } = useRealtimeChat({
    conversation,
    username,
    // Pass the dashboard updater down
    onMessageReceived, 
  });

  const [newMessage, setNewMessage] = useState("");
  const { role } = useSupabaseAuth();

  // Merge messages
  const allMessages = useMemo(() => {
    const mergedMessages = [...initialMessages, ...realtimeMessages];
    const seen = new Set<string>();
    const uniqueMessages = [] as typeof mergedMessages;

    for (const orig of mergedMessages) {
      const createdAtStr = typeof orig.createdAt === "string"
          ? orig.createdAt
          : orig.createdAt
          ? new Date(orig.createdAt).toISOString()
          : new Date().toISOString();

      const key = orig.id ?? `${createdAtStr}:${orig.content}`;
      if (!seen.has(String(key))) {
        seen.add(String(key));
        uniqueMessages.push({ ...orig, createdAt: createdAtStr } as any);
      }
    }
    
    uniqueMessages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return uniqueMessages;
  }, [initialMessages, realtimeMessages]);

  useEffect(() => {
    if (onMessage) {
      onMessage(allMessages);
    }
  }, [allMessages, onMessage]);

  useEffect(() => {
    // Scroll to bottom when messages change only if auto-scroll is enabled.
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  }, [allMessages, autoScrollEnabled, scrollToBottom]);

  // Mark as read logic
  useEffect(() => {
    const handleReadStatus = async () => {
      if (!conversation?.id || !userId) return;

      // 1. If we have realtime messages, check the last one
      const lastMsg = realtimeMessages.length > 0 
        ? realtimeMessages[realtimeMessages.length - 1] 
        : initialMessages[initialMessages.length - 1];

      // If the last message exists and WAS NOT sent by me, mark read immediately
      if (lastMsg && String(lastMsg.senderId) !== String(userId)) {
         try {
           await markAsRead(conversation.id, userId);
           // Optional: You might want to update the UI state locally here to show "read" 
           // if you track that in the sidebar
         } catch (err) {
           console.error("Failed to mark as read", err);
         }
      }
    };

    handleReadStatus();
  }, [realtimeMessages, conversation?.id, userId, initialMessages]); 
  // ^ Depending on realtimeMessages ensures this fires when a new message comes in

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;
      sendMessage(newMessage);
      setNewMessage("");
    },
    [newMessage, sendMessage]
  );

  // helper to let the user manually jump back to bottom
  const handleScrollToBottomClick = () => {
    setAutoScrollEnabled(true);
    scrollToBottom();
  };

  return (
    <div className="relative flex flex-col h-full min-h-0 w-full antialiased">
      <div 
        ref={containerRef} 
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
      >
        {allMessages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-10">
            No messages yet. Ask a question!
          </div>
        ) : (
          <div className="space-y-1">
            {allMessages.map((message, index) => {
              const prevMessage = index > 0 ? allMessages[index - 1] : null;
              const showHeader = !prevMessage || prevMessage.sender.username !== message.sender.username;

              return (
                <div key={message.id || index} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <ChatMessageItem
                    message={message}
                    isOwnMessage={String(message.sender.id) === String(userId)}
                    showHeader={showHeader}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSendMessage}
        className="shrink-0 flex w-full gap-2 border-t border-border p-4 bg-background"
      >
        {/* Removed disabled={!isConnected} from Input. 
            Allow typing while connecting. */}
        <Input
          className="rounded-full bg-background text-sm"
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={isConnected ? "Type a message..." : "Connecting..."}
        />
        
        {role === "admin" && (
          <OfferPricePopover product={conversation?.product} />
        )}
        
        <Button
          className="aspect-square rounded-full"
          type="submit"
          // Keep button disabled until connected or if empty
          disabled={!isConnected || !newMessage.trim()}
        >
          <Send className="size-4" />
        </Button>
      </form>

      {/* Scroll-to-bottom button */}
      {!autoScrollEnabled && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-20 z-40">
          <Button 
            size="sm" 
            variant="secondary" 
            className="rounded-full shadow-md"
            onClick={handleScrollToBottomClick}
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            New messages
          </Button>
        </div>
      )}
    </div>
  );
};