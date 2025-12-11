"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";

import { toast } from "sonner";

import { getUserByIdAction } from "@/app/actions/user";

import { persistMessage, PersistableMessage } from "@/services/messageService";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";

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

export function useRealtimeChat({
  conversation,
  username,
  onMessageReceived,
}: UseRealtimeChatProps) {
  const { user } = useSupabaseAuthContext();
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
          console.log("New message payload received:", newRecord);
          let senderInfo = {
            id: newRecord.sender_id,
            username: "Unknown",
            email: "",
            country: "",
            role: newRecord.sender_type as "customer" | "seller",
          };

          try {
            const senderUser = await getUserByIdAction(newRecord.sender_id);
            if (senderUser) {
              senderInfo = {
                id: senderUser.id,
                username: senderUser.username,
                email: senderUser.email,
                country: senderUser.country?.name || "",
                role: senderUser.role as "customer" | "seller",
              };
            }
          } catch (error) {
            console.error("Error fetching sender info", error);
          }

          const incomingMessage: ChatMessage = {
            id: newRecord.id,
            conversationId: newRecord.conversation_id,
            senderId: newRecord.sender_id,
            senderType: newRecord.sender_type,
            content: newRecord.content,
            isRead: newRecord.is_read,
            createdAt: newRecord.created_at.endsWith("Z")
              ? newRecord.created_at
              : `${newRecord.created_at}Z`,
            sender: senderInfo,
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

  const sendMessage = useCallback(
    async (content: string) => {
      // Allow sending if we have a user, even if socket momentarily disconnected (optimistic),
      // though usually we want to wait for connection.
      if (!conversation?.id || !user?.id) {
        return;
      }

      try {
        const foundUser = await getUserByIdAction(user.id);
        if (!foundUser) {
          console.error("User not found in DB:", user.id);
          toast.error("User not found");
          return;
        }

        const userRole = foundUser.role;
        const messageId = crypto.randomUUID();

        const message: ChatMessage = {
          id: messageId,
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

        // Persist
        const messageToPersist: PersistableMessage = {
          id: messageId,
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
