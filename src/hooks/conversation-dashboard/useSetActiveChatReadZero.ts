import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";
import { useEffect } from "react";
import { markAsRead } from "@/services/messageService";
import { User } from "@supabase/supabase-js";

export default function useSetActiveChatReadZero(selectedConversationId: string | null, user: User | null) {
  const { unreadCounts, setUnreadCounts } = useUnreadMessagesContext();
   // Since the global hook increments counters blindly, we must reset the counter
    // if the incoming message belongs to the currently selected conversation.
    useEffect(() => {
      if (selectedConversationId && unreadCounts[selectedConversationId] > 0) {
          // Reset unread count immediately if we are looking at this chat
          setUnreadCounts(prev => ({ ...prev, [selectedConversationId]: 0 }));
          
          // mark as read, sync wit hdb
          if(user?.id) markAsRead(selectedConversationId, user.id);
      }
    }, [unreadCounts, selectedConversationId, setUnreadCounts, user?.id]);
}
