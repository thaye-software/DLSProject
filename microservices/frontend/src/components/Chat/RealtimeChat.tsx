"use client";

import { cn } from "@/lib/tailwindUtils";
import { ChatMessageItem } from "@/components/Chat/ChatMessage";
import { useChatScroll } from "@/hooks/useChatScroll";
import { type ChatMessage, useRealtimeChat } from "@/hooks/useRealtimeChat";
import type { Conversation } from "@/services/conversationService";
import { Button } from "@/components/ui/button";
import { ArrowDown, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";

interface RealtimeChatProps {
  conversation: Conversation;
  userId: string;
  onMessageReceived?: (message: ChatMessage) => void;
  onRead?: () => void;
}

export const RealtimeChat = ({ conversation, userId, onMessageReceived, onRead }: RealtimeChatProps) => {
  const {
    containerRef,
    scrollToBottom,
    autoScrollEnabled,
    setAutoScrollEnabled,
  } = useChatScroll();

  const { messages: realtimeMessages, sendMessage, isConnected } = useRealtimeChat({
    conversation,
    userId,
    onMessageReceived,
    onRead,
  });

  // The history page and live messages arrive separately: show them oldest first.
  const allMessages = useMemo(
    () => [...realtimeMessages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [realtimeMessages],
  );

  const [newMessage, setNewMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  }, [allMessages, autoScrollEnabled, scrollToBottom]);

  // preselect the textare/input when chat/conversations has been selected
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Set height to scrollHeight, but cap at max-height (200px)
    const maxHeight = 200; // Match max-h-[200px] in className
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [newMessage]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;

      if (newMessage.length > 2000) {
        toast.error(
          "Your message is to long cant exceed more than 2000 characters."
        );
        return;
      }

      sendMessage(newMessage);
      setNewMessage("");

      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
    [newMessage, sendMessage]
  );

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
              const showHeader =
                !prevMessage || prevMessage.sender_user_id !== message.sender_user_id;

              return (
                <div
                  key={message.message_id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <ChatMessageItem
                    message={{
                      username:
                        message.sender_user_id === conversation.customer_user_id
                          ? conversation.customer_display_name
                          : "Seller",
                      content: message.content,
                      createdAt: message.created_at,
                    }}
                    isOwnMessage={message.sender_user_id === userId}
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
        className="shrink-0 flex w-full items-end gap-2 border-t border-border p-4 bg-background"
      >
        <div className="flex items-end gap-3 w-full">
          {/* Textarea container (now flex-1 and flex-col to stack badge and textarea) */}
          <div className="flex-1 flex flex-col">
            {/* Badge stays above the textarea */}
            <Badge
              variant="secondary"
              className="text-xs mb-2 self-start" // Added self-start for better alignment
            >
              {newMessage.length}/2000
            </Badge>

            <textarea
              ref={textareaRef}
              className={cn(
                "w-full rounded-2xl bg-background text-sm px-4 py-2.5",
                "border border-input resize-none",
                "placeholder:text-muted-foreground",
                "min-h-[42px] max-h-[200px]",
                "overflow-y-auto"
              )}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (isConnected && newMessage.trim()) {
                    handleSendMessage(e as any);
                  }
                }
              }}
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              rows={1}
              maxLength={-1} // no max length
            />
          </div>

          <Button
            className="aspect-square rounded-full shrink-0"
            type="submit"
            disabled={!isConnected || !newMessage.trim()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>

      {!autoScrollEnabled && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-20 z-40">
          <Button
            size="sm"
            className="rounded-full shadow-md mb-10 border-2 border-background"
            onClick={handleScrollToBottomClick}
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            Latest messages
          </Button>
        </div>
      )}
    </div>
  );
};
