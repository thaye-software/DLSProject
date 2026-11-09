import { ConversationModel, MessageModel } from "@/database/types";
import { useEffect } from "react";


export default function useSyncUnreadCounts(user: any, initialConversations: any, setUnreadCounts: Function) {
  useEffect(() => {
    if (!user || !initialConversations) return;
    
    // Only set if context is empty (prevents overwriting live updates from Sidebar)
    // or you can implement smarter merge logic.
    setUnreadCounts((prev: Record<string, number>) => {
        const initialUnreads: Record<string, number> = { ...prev };
        initialConversations.forEach((conv: ConversationModel) => {
            const dbCount = conv.messages.filter(
                (message: MessageModel) => !message.isRead && message.senderType === "customer" && message.senderId !== user.id
            ).length;
            // Only update if not already tracked (or simply overwrite if you trust DB fresh fetch)
            initialUnreads[conv.id] = dbCount;
        });
        return initialUnreads;
    });
  }, [initialConversations, user, setUnreadCounts]);
}