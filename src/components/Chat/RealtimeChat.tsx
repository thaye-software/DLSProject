"use client";

import { cn } from "@/lib/tailwindUtils";
import { ChatMessageItem } from "@/components/Chat/ChatMessage";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { type ChatMessage, useRealtimeChat } from "@/hooks/use-realtime-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, HandCoins, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { markAsRead } from "@/services/messageService";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { OfferPricePopover } from "./OfferPricePopover";

interface RealtimeChatProps {
  conversation: any;
  userId: string;
  username: string;
  onMessage?: (messages: ChatMessage[]) => void;
  onLatestMessage?: (conversationId: string, message: ChatMessage) => void; // NEW
  messages?: ChatMessage[];
}

export const RealtimeChat = ({
  conversation,
  userId,
  username,
  onMessage,
  onLatestMessage, // used to sync parent component ie. admin ConversationDashboard
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
  });
  const [newMessage, setNewMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const { role } = useSupabaseAuth();

  // Merge realtime messages with initial messages
  const allMessages = useMemo(() => {
    const mergedMessages = [...initialMessages, ...realtimeMessages];

    // Normalize id to string when present and normalize createdAt to ISO strings
    const seen = new Set<string>();
    const uniqueMessages = [] as typeof mergedMessages;

    for (const orig of mergedMessages) {
      // normalize createdAt to an ISO string so sorting/comparisons are reliable
      const createdAtStr =
        typeof orig.createdAt === "string"
          ? orig.createdAt
          : orig.createdAt
          ? new Date(orig.createdAt).toISOString()
          : new Date().toISOString();

      // use id if present, otherwise fallback to createdAt+content as dedupe key
      const key = orig.id ?? `${createdAtStr}:${orig.content}`;
      if (!seen.has(String(key))) {
        seen.add(String(key));
        uniqueMessages.push({ ...orig, createdAt: createdAtStr } as any);
      }
    }
    // Sort by creation date (use numeric timestamp compare to avoid type issues)
    uniqueMessages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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

  // set message.isRead to true for all messages where isOwnMessage is false when component mounts
  useEffect(() => {
    const markMessagesAsRead = async () => {
      try {
        if (!conversation || !conversation.id || !userId) {
          console.warn("markMessagesAsRead: missing conversation or userId");
          return;
        }
        await markAsRead(conversation.id, userId);
      } catch (err) {
        console.error("markAsRead failed", err);
      }
    };
    // run when conversation or userId becomes available
    markMessagesAsRead();
  }, [conversation, userId]);

  // used to sync dashboard sidebar ie notify the parent
  useEffect(() => {
    if (onLatestMessage && allMessages.length > 0) {
      const latestMessage = allMessages[allMessages.length - 1];
      onLatestMessage(conversation.id, latestMessage);
    }
  }, [allMessages, conversation.id, onLatestMessage]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !isConnected) return;

      sendMessage(newMessage);
      setNewMessage("");
    },
    [newMessage, isConnected, sendMessage]
  );

  // helper to let the user manually jump back to bottom
  const handleScrollToBottomClick = () => {
    setAutoScrollEnabled(true);
    scrollToBottom();
  };

  return (
    // FIXED: Added min-h-0 and relative for the scroll button positioning
    <div className="relative flex flex-col h-full min-h-0 w-full antialiased">
      {/* Messages container - flex-1 min-h-0 allows it to shrink and scroll */}
      <div 
        ref={containerRef} 
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
      >
        {allMessages.length === 0 ? (
          <div className="text-center text-sm">
            No messages yet. Ask a question!
          </div>
        ) : (
          <div className="space-y-1">
            {allMessages.map((message, index) => {
              const prevMessage = index > 0 ? allMessages[index - 1] : null;
              const showHeader =
                !prevMessage ||
                prevMessage.sender.username !== message.sender.username;

              return (
                <div
                  key={message.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                >
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

      {/* FIXED: Added shrink-0 to prevent form from disappearing */}
      <form
        onSubmit={handleSendMessage}
        className="shrink-0 flex w-full gap-2 border-t border-border p-4"
      >
        <Input
          className={cn(
            "rounded-full bg-background text-sm transition-all duration-300",
            isConnected && newMessage.trim() ? "w-[calc(100%-36px)]" : "w-full"
          )}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        {role === "admin" && (
          <OfferPricePopover product={conversation?.product} />
        )}
        {isConnected && newMessage.trim() && (
          <Button
            className="aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300"
            type="submit"
            disabled={!isConnected}
          >
            <Send className="size-4" />
          </Button>
        )}
      </form>

      {/* Scroll-to-bottom button */}
      {!autoScrollEnabled && (
        <div className="absolute left-2 bottom-[75px] z-40 cursor-pointer">
          <Button size="icon" onClick={handleScrollToBottomClick}>
            <ArrowDown />
          </Button>
        </div>
      )}
    </div>
  );
};