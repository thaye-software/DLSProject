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
  messages?: ChatMessage[];
}

/**
 * Realtime chat component
 * @param conversationName - The name of the conversation to join. Each conversation is a unique chat.
 * @param username - The username of the user
 * @param onMessage - The callback function to handle the messages. Useful if you want to store the messages in a database.
 * @param messages - The messages to display in the chat. Useful if you want to display messages from a database.
 * @returns The chat component
 */
export const RealtimeChat = ({
  conversation,
  userId,
  username,
  onMessage,
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

        const convId = conversation.id;
        console.log("userId:", userId);
        await markAsRead(convId, userId);
      } catch (err) {
        console.error("markAsRead failed", err);
      }
    };
    // run when conversation or userId becomes available
    markMessagesAsRead();
  }, [conversation, userId]);

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
  console.log("conversation:", conversation);

  return (
    <div className="flex flex-col h-full w-full antialiased">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.length === 0 ? (
          <div className="text-center text-sm">
            No messages yet. Ask a question!
          </div>
        ) : null}
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
      </div>

      <form
        onSubmit={handleSendMessage}
        className="flex w-full gap-2 border-t border-border p-4"
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
      {/* scroll-to-bottom button when auto-scroll is disabled */}
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
