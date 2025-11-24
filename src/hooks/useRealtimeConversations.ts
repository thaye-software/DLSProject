// hooks/useRealtimeConversations.ts
"use client";

import { useEffect } from "react";
import { createClient } from "@/database/supabase/client";
import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import type { ConversationModel } from "@/database/types";
import { ChatMessage } from "@/hooks/use-realtime-chat";

export function useRealtimeConversations(initialConversations: ConversationModel[]) {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  
  // Destructure the new helper from context
  const { setUnreadCounts, addRealtimeMessage } = useUnreadMessagesContext();

  useEffect(() => {
    // Guard clauses
    if (!initialConversations || initialConversations.length === 0 || !user) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    initialConversations.forEach((conv) => {
      const channelName = `chat:${conv.id}`;
      const channel = supabase.channel(channelName);

      channel
        .on("broadcast", { event: "message" }, (payload) => {
          const incomingMessage = payload.payload as ChatMessage;

          if (incomingMessage.conversationId === conv.id) {
            
            // 1. GLOBAL: Store the message in Context (available to Dashboard)
            addRealtimeMessage(conv.id, incomingMessage);

            // 2. GLOBAL: Handle Unread Counts
            const isFromCustomer = incomingMessage.senderType === "customer";
            const isNotFromMe = incomingMessage.senderId !== user.id;

            if (isFromCustomer && isNotFromMe) {
               // NOTE: We increment blindly here because the Hook doesn't know 
               // if the Dashboard is open or which chat is selected. 
               // The Dashboard component will be responsible for clearing this 
               // count immediately if the chat is open.
              setUnreadCounts((prev) => ({
                ...prev,
                [conv.id]: (prev[conv.id] ?? 0) + 1,
              }));
            }
          }
        })
        .subscribe();

      channels.push(channel);
    });

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [initialConversations, user, supabase, setUnreadCounts, addRealtimeMessage]);
}