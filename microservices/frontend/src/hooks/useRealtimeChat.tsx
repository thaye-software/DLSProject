"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";

import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

interface UseRealtimeChatProps {
  conversation: any;
  username: string;
  // Callback to notify parent (Dashboard) to update sidebar
  onMessageReceived?: (message: ChatMessage) => void;
}

export interface ChatMessage {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  username: string;
  senderType?: "customer" | "seller";
  content: string;
  isRead?: boolean;
  createdAt: string;
}

export function useRealtimeChat({
  conversation,
  onMessageReceived,
}: UseRealtimeChatProps) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Ref to track current channel to prevent race conditions in cleanup
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversation?.id) {
      return;
    }

    // Cleanup previous channel if exists (Safety for Bug 4)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `chat:${conversation.id}`;
    const newChannel = supabase.channel(channelName);
    channelRef.current = newChannel;

    // Check if already joined (e.g. by Sidebar)
    const isAlreadyJoined = newChannel.state === "joined";
    if (isAlreadyJoined) {
      setIsConnected(true);
    }

    newChannel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload: any) => {
          const newRecord = payload.new;
          // convert payload to ChatMessage
          const incomingMessage: ChatMessage = {
            id: newRecord.id,
            conversationId: newRecord.conversation_id,
            senderId: newRecord.sender_id,
            username: newRecord.username,
            senderType: newRecord.sender_type,
            content: newRecord.content,
            isRead: newRecord.is_read,
            createdAt: newRecord.created_at.endsWith("Z")
              ? newRecord.created_at
              : `${newRecord.created_at}Z`,
          };
          
          setMessages((current) => {
            if (current.some((m) => m.id === incomingMessage.id)) {
              return current;
            }
            return [...current, incomingMessage];
          });

          // Notify parent to update sidebar
          if (onMessageReceived) {
            onMessageReceived(incomingMessage);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      setIsConnected(false);

      // Only remove channel if it wasn't already joined when we got it
      // This prevents killing the Sidebar's subscription
      if (channelRef.current && !isAlreadyJoined) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
      setMessages([]);
    };
  }, [conversation?.id, supabase, onMessageReceived]);

  // Persisting messages goes through the gateway in Task 8.
  const sendMessage = useCallback(async (_content: string) => {
    toast.error("Chat is not available yet.");
  }, []);

  return { messages, sendMessage, isConnected };
}
