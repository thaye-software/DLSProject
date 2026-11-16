"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { listMessages, markRead, sendMessage as sendMessageAction } from "@/app/chat/actions";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, Conversation } from "@/services/conversationService";

export type { ChatMessage };

interface UseRealtimeChatProps {
  conversation: Conversation;
  userId: string;
  // Called after the conversation was marked read (parent refreshes its unread count)
  onRead?: () => void;
  // Called for every message added to this conversation, own or incoming
  onMessageReceived?: (message: ChatMessage) => void;
}

// Appends a message unless one with the same id is already there (sender also gets its own broadcast).
const addMessage = (list: ChatMessage[], m: ChatMessage) =>
  list.some((x) => x.message_id === m.message_id) ? list : [...list, m];

export function useRealtimeChat({ conversation, userId, onRead, onMessageReceived }: UseRealtimeChatProps) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const id = conversation.conversation_id;

  const markReadNow = useCallback(async () => {
    if ((await markRead(id)).ok) onRead?.();
  }, [id, onRead]);

  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`conversation:${id}`)
      .on("broadcast", { event: "message_created" }, ({ payload }: { payload: unknown }) => {
        const message = payload as ChatMessage;
        setMessages((cur) => addMessage(cur, message));
        onMessageReceived?.(message);
        if (message.sender_user_id !== userId) void markReadNow();
      })
      .subscribe((status: string) => {
        if (!active) return;
        setIsConnected(status === "SUBSCRIBED");
        // Load history once subscribed so nothing sent in between is missed (merged by id).
        if (status === "SUBSCRIBED") {
          void listMessages(id).then((r) => {
            if (!active) return;
            if (!r.ok) return void toast.error(r.error);
            setMessages((cur) => r.data.items.reduce(addMessage, cur));
            void markReadNow();
          });
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
      setIsConnected(false);
      setMessages([]);
    };
    // onMessageReceived/markReadNow are intentionally read through the first render of this conversation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, supabase, userId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const r = await sendMessageAction(id, content, crypto.randomUUID());
      if (!r.ok) return void toast.error(r.error);
      setMessages((cur) => addMessage(cur, r.data));
      onMessageReceived?.(r.data);
    },
    [id, onMessageReceived],
  );

  return { messages, sendMessage, isConnected };
}
