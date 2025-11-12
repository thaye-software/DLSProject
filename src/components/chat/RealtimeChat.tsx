"use client";

import { cn } from "@/lib/utils";
import { ChatMessageItem } from "@/components/chat/ChatMessage";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { type ChatMessage, useRealtimeChat } from "@/hooks/use-realtime-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

interface RealtimeChatProps {
  roomName: string;
  userId: string | null;
  username: string;
  onMessage?: (messages: ChatMessage[]) => void;
  messages?: ChatMessage[];
}

/**
 * Realtime chat component
 * @param roomName - The name of the room to join. Each room is a unique chat.
 * @param username - The username of the user
 * @param onMessage - The callback function to handle the messages. Useful if you want to store the messages in a database.
 * @param messages - The messages to display in the chat. Useful if you want to display messages from a database.
 * @returns The chat component
 */
export const RealtimeChat = ({
  roomName,
  userId,
  username,
  onMessage,
  messages: initialMessages = [],
}: RealtimeChatProps) => {
  const { containerRef, scrollToBottom, autoScrollEnabled, setAutoScrollEnabled } = useChatScroll();

  const {
    messages: realtimeMessages,
    sendMessage,
    isConnected,
  } = useRealtimeChat({
    roomName,
    username,
  });
  const [newMessage, setNewMessage] = useState("");

  // Merge realtime messages with initial messages
  const allMessages = useMemo(() => {
    const mergedMessages = [...initialMessages, ...realtimeMessages];

    // Normalize id to string when present
    const seen = new Set<string>();
    const uniqueMessages = [] as typeof mergedMessages;

    for (const m of mergedMessages) {
      // use id if present, otherwise fallback to createdAt+content as dedupe key
      const key = m.id ?? `${m.createdAt}:${m.content}`;
      if (!seen.has(String(key))) {
        seen.add(String(key));
        uniqueMessages.push(m);
      }
    }

    // Sort by creation date (ISO strings sort lexicographically)
    uniqueMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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
      scrollToBottom()
    }
  }, [allMessages, autoScrollEnabled, scrollToBottom])

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
    setAutoScrollEnabled(true)
    scrollToBottom()
  }

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
        <div className="absolute right-4 bottom-[84px] z-40">
          <Button size="sm" onClick={handleScrollToBottomClick}>
            Scroll to bottom
          </Button>
        </div>
      )}
    </div>
  );
};
