import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";

import { useRealtimeConversations } from "@/hooks/useRealtimeConversations";

import { getAllConversations } from "@/services/conversationService";

import { ConversationModel } from "@/database/types";



export default function ConversationsLinkContent() {
  
  const { unreadCounts, setUnreadCounts } = useUnreadMessagesContext();
  const [initialConversations, setInitialConversations] = useState<ConversationModel[]>([]);

  useEffect(() => {
    async function syncUnreadMessages() {

      const allConversations = await getAllConversations();
      setInitialConversations(allConversations);

      const unreadMessages: Record<string, number> = {};
      allConversations.forEach( conv => {
        unreadMessages[conv.id] = conv.messages.filter( message => message.isRead === false && message.senderType === "customer").length;
      });

      setUnreadCounts(unreadMessages)
    }
    syncUnreadMessages();

  }, [setUnreadCounts])

  useRealtimeConversations(initialConversations);

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  //                         ^^since unreadCounts is a record we we can extract the values by call .values on Objects.


   return (
    <span className="flex items-center gap-2">
      Conversations
      {totalUnread > 0 && (
        <Badge
          variant="destructive"
          className="h-5 px-1.5 text-[10px] shrink-0"
        >
          {String(totalUnread)}
        </Badge>
      )}
    </span>
  );
}