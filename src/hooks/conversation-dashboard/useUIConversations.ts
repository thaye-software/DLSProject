import { UIConversation } from "@/components/Admin/Conversations/ConversationDashboard";
import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";
import { ConversationModel } from "@/database/types";
import { useMemo } from "react";

export default function useUIConversations(initialConversations: ConversationModel[]) {
  const { unreadCounts, realtimeMessages } = useUnreadMessagesContext();

  //@ts-ignore
  return useMemo<UIConversation[]>(() => {
      return initialConversations.map((conv) => {
        
        // 1. Get Context Messages
        const realtimeMsgs = realtimeMessages[conv.id] || [];
  
        // 2. MERGE STRATEGY (Deduplication):
        // Create a Set of existing DB message IDs for O(1) lookups
        const dbMessageIds = new Set(conv.messages.map(m => m.id));
  
        // Only add realtime messages that are NOT already in the DB list
        const uniqueRealtimeMsgs = realtimeMsgs.filter(m => !dbMessageIds.has(m.id as string));
  
        // Combine DB + Unique Realtime
        const combinedMessages = [...conv.messages, ...uniqueRealtimeMsgs];
  
        // 3. Sort Combined List (Newest First)
        const sortedMessages = combinedMessages.sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        
        // 4. Determine "True" Latest Message
        // SIMPLIFICATION: We already sorted them, so index 0 is always the newest.
        const lastMsgObj = sortedMessages[0]; 
  
        // 5. Customer Info Logic
        // We can now look through the combined list comfortably
        let customerName = "Unknown Customer";
        let customerInitials = "??";
  
        const customerMsg = sortedMessages.find(m => m.senderType === "customer");
  
        //@ts-ignore
        if (customerMsg?.sender) {
          //@ts-ignore
          const { firstName, lastName, username } = customerMsg.sender;
          customerName = firstName && lastName ? `${firstName} ${lastName}` : username || "Customer";
        }
  
        if (customerName !== "Unknown Customer") {
          customerInitials = customerName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
        }
  
        const imgUrl = conv.product.productImages?.[0]
          ? (conv.product.productImages[0] as any).url || (conv.product.productImages[0] as any).imageUrl
          : null;
  
        let productName = conv.product.watch.brand.name + " " + conv.product.watch.model;
        if (productName.length > 35) {
          productName = productName.substring(0, 25) + "...";
        }
  
        return {
          id: conv.id,
          productId: conv.productId,
          productSlug: conv.product.watch.slug,
          productRef: conv.product.watch.reference,
          productName,
          productImage: imgUrl,
          customerId: conv.customerId,
          customerName,
          customerInitials,
          // Safe check in case there are 0 messages total
          lastMessageContent: lastMsgObj?.content || "No messages yet",
          lastMessageAt: lastMsgObj?.createdAt
            ? new Date(lastMsgObj.createdAt)
            : new Date(conv.createdAt || Date.now()),
          lastMessageSenderId: lastMsgObj?.senderId || null,
          status: conv.status || "open",
          unreadCount: unreadCounts[conv.id] ?? 0,
          
          // ⚠️ CRITICAL FIX HERE: Return the combined list, not just the DB list
          sortedMessages: sortedMessages, 
        };
      });
    }, [initialConversations, realtimeMessages, unreadCounts]);
}
