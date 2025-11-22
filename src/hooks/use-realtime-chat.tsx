"use client";

import { createClient } from "@/database/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { persistMessage, PersistableMessage } from "@/services/messageService";
import { useCallback, useEffect, useState } from "react";

interface UseRealtimeChatProps {
  conversation: any;
  username: string;
}

export interface ChatMessage {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  sender: {
    id: string | null;
    username: string;
    email: string;
    country: string;
    role: "customer" | "seller";
  };
  senderType?: "customer" | "seller";
  content: string;
  isRead?: boolean;
  createdAt: string;
}

const EVENT_MESSAGE_TYPE = "message";

export function useRealtimeChat({
  conversation,
  username,
}: UseRealtimeChatProps) {
  const { user } = useSupabaseAuth();
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channel, setChannel] = useState<ReturnType<
    typeof supabase.channel
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Guard: Don't create channel if no conversation ID
    if (!conversation?.id) {
      console.warn("useRealtimeChat: No conversation ID provided");
      return;
    }

    // FIX: Use a unique channel name based on conversation ID
    const channelName = `chat:${conversation.id}`;
    const newChannel = supabase.channel(channelName);

    newChannel
      .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload) => {
        const incomingMessage = payload.payload as ChatMessage;
        
        // EXTRA SAFETY: Only add message if it belongs to this conversation
        if (incomingMessage.conversationId === conversation.id) {
          setMessages((current) => [...current, incomingMessage]);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    setChannel(newChannel);

    // Cleanup: remove channel AND reset messages when conversation changes
    return () => {
      supabase.removeChannel(newChannel);
      setMessages([]); // Clear messages when switching conversations
    };
  }, [conversation?.id, supabase]); // Only depend on conversation.id, not the whole object

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected || !conversation?.id) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        conversationId: conversation.id, // This is crucial for filtering
        senderId: user?.id ?? null,
        sender: {
          id: user?.id ?? null,
          username,
          email: "",
          country: "",
          role: "customer",
        },
        senderType: "customer",
        content,
        createdAt: new Date().toISOString(),
      };

      // Update local state immediately for the sender
      setMessages((current) => [...current, message]);

      await channel.send({
        type: "broadcast",
        event: EVENT_MESSAGE_TYPE,
        payload: message,
      });

      const messageToPersist: PersistableMessage = {
        conversationId: conversation.id,
        senderId: user?.id ?? "",
        senderType: "customer",
        content,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      // Persist message to backend
      await persistMessage(messageToPersist);
    },
    [channel, isConnected, conversation?.id, username, user?.id]
  );

  return { messages, sendMessage, isConnected };
}