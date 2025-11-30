"use client";

import { createClient } from "@/database/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { persistMessage, PersistableMessage } from "@/services/messageService";
import { getUserByIdAction } from "@/app/actions/user";
import { useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";

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
  onMessageReceived,
}: UseRealtimeChatProps) {
  const { user } = useSupabaseAuth();
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Ref to track current channel to prevent race conditions in cleanup
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversation?.id) return;

    // Cleanup previous channel if exists (Safety for Bug 4)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `chat:${conversation.id}`;
    const newChannel = supabase.channel(channelName);
    channelRef.current = newChannel;

    newChannel
      .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload) => {
        const incomingMessage = payload.payload as ChatMessage;

        if (incomingMessage.conversationId === conversation.id) {
          setMessages((current) => [...current, incomingMessage]);

          // Notify parent to update sidebar
          if (onMessageReceived) {
            onMessageReceived(incomingMessage);
          }
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to channel:", channelName);
          setIsConnected(true);
        } else {
          console.log("Unsubscribed from channel:", channelName);
          setIsConnected(false);
        }
      });

    return () => {
      setIsConnected(false);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setMessages([]);
    };
  }, [conversation?.id, supabase, onMessageReceived]);

  const sendMessage = useCallback(
    async (content: string) => {
      // Allow sending if we have a user, even if socket momentarily disconnected (optimistic),
      // though usually we want to wait for connection.
      if (!conversation?.id || !user?.id) return;

      try {
        const foundUser = await getUserByIdAction(user.id);
        if (!foundUser) {
          toast.error("User not found");
          return;
        }

        const userRole = foundUser.role;

        const message: ChatMessage = {
          id: crypto.randomUUID(),
          conversationId: conversation.id,
          senderId: user.id,
          sender: {
            id: user.id,
            username,
            email: foundUser.email || "",
            country: foundUser.country?.name || "",
            role: userRole === "admin" ? "seller" : "customer",
          },
          senderType: userRole === "admin" ? "seller" : "customer",
          content,
          createdAt: new Date().toISOString(),
        };

        // Update local state
        setMessages((current) => [...current, message]);

        // Notify Parent (Dashboard) immediately for own message too
        if (onMessageReceived) {
          onMessageReceived(message);
        }

        // Broadcast
        if (channelRef.current && isConnected) {
          await channelRef.current.send({
            type: "broadcast",
            event: EVENT_MESSAGE_TYPE,
            payload: message,
          });
        }

        // Persist
        const messageToPersist: PersistableMessage = {
          conversationId: conversation.id,
          senderId: user.id,
          senderType: userRole === "admin" ? "seller" : "customer",
          content,
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        await persistMessage(messageToPersist);
      } catch (error) {
        console.error("Failed to send message", error);
        toast.error("Failed to send message");
      }
    },
    [isConnected, conversation?.id, username, user?.id, onMessageReceived]
  );

  return { messages, sendMessage, isConnected };
}
