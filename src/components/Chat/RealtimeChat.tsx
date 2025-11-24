"use client";

import { cn } from "@/lib/tailwindUtils";
import { ChatMessageItem } from "@/components/Chat/ChatMessage";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { type ChatMessage, useRealtimeChat } from "@/hooks/use-realtime-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markAsRead } from "@/services/messageService";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { OfferPricePopover } from "./OfferPricePopover";
import { toast } from "sonner";
import { Badge } from "../ui/badge";

interface RealtimeChatProps {
  conversation: any;
  userId: string;
  username: string;
  onMessage?: (messages: ChatMessage[]) => void;
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
    onMessageReceived, 
  });

  const [newMessage, setNewMessage] = useState("");
  const { role } = useSupabaseAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  }, [allMessages, autoScrollEnabled, scrollToBottom]);

  // Mark as read logic
  useEffect(() => {
    const handleReadStatus = async () => {
      if (!conversation?.id || !userId) return;

      const lastMsg = realtimeMessages.length > 0 
        ? realtimeMessages[realtimeMessages.length - 1] 
        : initialMessages[initialMessages.length - 1];

      if (lastMsg && String(lastMsg.senderId) !== String(userId)) {
         try {
           await markAsRead(conversation.id, userId);
         } catch (err) {
           console.error("Failed to mark as read", err);
         }
      }
    };

    handleReadStatus();
  }, [realtimeMessages, conversation?.id, userId, initialMessages]); 

  // ✅ Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight, but cap at max-height (200px)
    const maxHeight = 200; // Match max-h-[200px] in className
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [newMessage]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;

      if(newMessage.length > 2000) {
        toast.error("Your message is to long cant exceed more than 2000 characters.")
        return;
      }

      sendMessage(newMessage);
      setNewMessage("");
      
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
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
                if (e.key === 'Enter' && !e.shiftKey) {
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
            
            {/* Action buttons (aligned to the bottom by the parent div) */}
            {role === "admin" && (
                <OfferPricePopover product={conversation?.product} />
            )}
            
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