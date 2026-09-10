import { ConversationDashboard } from "@/components/Admin/Conversations/ConversationDashboard";
import { getAllConversations } from "@/services/conversationService";

export default async function ConversationsPage() {

  const initialConversations = await getAllConversations();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Customer Conversations</h1>
        <p className="text-muted-foreground">
          Manage inquiries and chat with customers about specific products.
        </p>
      </div>
      
      <ConversationDashboard initialConversations={initialConversations} />
    </div>
  );
}