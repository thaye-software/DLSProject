"use client";

import { createClient } from "@/database/supabase/client";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { persistMessage, PersistableMessage } from "@/services/messageService";
import { useCallback, useEffect, useState } from "react";

interface UseRealtimeChatProps {
  roomName: any;
  username: string;
}

export interface ChatMessage {
  id?: string;
  conversationId?: number;
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

export function useRealtimeChat({ roomName, username }: UseRealtimeChatProps) {
  const { user } = useSupabaseAuth();
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channel, setChannel] = useState<ReturnType<
    typeof supabase.channel
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newChannel = supabase.channel(roomName);

    newChannel
      .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload) => {
        setMessages((current) => [...current, payload.payload as ChatMessage]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [roomName, username, supabase]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        conversationId: Number(roomName.id),
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

      console.log("Sending message:", message);

      // Update local state immediately for the sender
      setMessages((current) => [...current, message]);

      await channel.send({
        type: "broadcast",
        event: EVENT_MESSAGE_TYPE,
        payload: message,
      });

      const messageToPersist: PersistableMessage = {
        conversationId: Number(roomName.id),
        senderId: user?.id ?? "",
        senderType: "customer",
        content,
        isRead: false,
        createdAt: new Date().toISOString(),
      }

      // Persist message to backend
      await persistMessage(messageToPersist);
    },
    [channel, isConnected, username, user?.id]
  );

  return { messages, sendMessage, isConnected };
}
