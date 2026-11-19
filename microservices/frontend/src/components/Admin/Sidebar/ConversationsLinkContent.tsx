import { Badge } from "@/components/ui/badge";

import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";

export default function ConversationsLinkContent() {
  const { totalUnread } = useUnreadMessagesContext();

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