"use client";

import { createClient } from "@/database/supabase/client";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { persistMessage, PersistableMessage } from "@/services/messageService";
import { getUserByIdAction } from "@/app/actions/user";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
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
  const { user } = useSupabaseAuthContext();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Ref to track current channel to prevent race conditions in cleanup
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    console.log("useRealtimeChat: useEffect triggered", {
      conversationId: conversation?.id,
    });
    if (!conversation?.id) {
      console.log("No conversation ID provided, skipping channel setup.");
      return;
    }

    // Cleanup previous channel if exists (Safety for Bug 4)
    if (channelRef.current) {
      console.log("Cleaning up previous channel");
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `chat:${conversation.id}`;
    console.log("Setting up channel:", channelName);
    const newChannel = supabase.channel(channelName);
    channelRef.current = newChannel;

    // Check if already joined (e.g. by Sidebar)
    const isAlreadyJoined = newChannel.state === "joined";
    if (isAlreadyJoined) {
      console.log("Channel already joined, setting connected immediately");
      setIsConnected(true);
    }

    newChannel
      .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload: any) => {
        const incomingMessage = payload.payload as ChatMessage;
        console.log("Received broadcast message:", incomingMessage);

        if (incomingMessage.conversationId === conversation.id) {
          setMessages((current) => [...current, incomingMessage]);

          // Notify parent to update sidebar
          if (onMessageReceived) {
            onMessageReceived(incomingMessage);
          }
        }
      })
      .subscribe((status: string) => {
        console.log(`Channel ${channelName} status change:`, status);
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to channel:", channelName);
          setIsConnected(true);
        } else {
          console.log("Unsubscribed from channel:", channelName);
          setIsConnected(false);
        }
      });

    return () => {
      console.log("useRealtimeChat: cleanup");
      setIsConnected(false);

      // Only remove channel if it wasn't already joined when we got it
      // This prevents killing the Sidebar's subscription
      if (channelRef.current && !isAlreadyJoined) {
        console.log("Removing channel (was not pre-joined)");
        supabase.removeChannel(channelRef.current);
      } else {
        console.log("Skipping removeChannel (was pre-joined)");
      }
      channelRef.current = null;
      setMessages([]);
    };
  }, [conversation?.id, supabase, onMessageReceived]);

  const sendMessage = useCallback(
    async (content: string) => {
      console.log("sendMessage called", {
        content,
        conversationId: conversation?.id,
        userId: user?.id,
        isConnected,
      });

      // Allow sending if we have a user, even if socket momentarily disconnected (optimistic),
      // though usually we want to wait for connection.
      if (!conversation?.id || !user?.id) {
        console.warn("Cannot send message: Missing conversation ID or User ID");
        return;
      }

      try {
        console.log("Fetching user details for:", user.id);
        const foundUser = await getUserByIdAction(user.id);
        if (!foundUser) {
          console.error("User not found in DB:", user.id);
          toast.error("User not found");
          return;
        }
        console.log("User details found:", foundUser);

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
          console.log("Broadcasting message...");
          await channelRef.current.send({
            type: "broadcast",
            event: EVENT_MESSAGE_TYPE,
            payload: message,
          });
        } else {
          console.warn("Not broadcasting: Channel not ready or disconnected", {
            channel: !!channelRef.current,
            isConnected,
          });
        }

        // Persist
        console.log("Persisting message...");
        const messageToPersist: PersistableMessage = {
          conversationId: conversation.id,
          senderId: user.id,
          senderType: userRole === "admin" ? "seller" : "customer",
          content,
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        await persistMessage(messageToPersist);
        console.log("Message persisted successfully");
      } catch (error) {
        console.error("Failed to send message", error);
        toast.error("Failed to send message");
      }
    },
    [isConnected, conversation?.id, username, user?.id, onMessageReceived]
  );

  return { messages, sendMessage, isConnected };
}
