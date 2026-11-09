import { Badge } from "@/components/ui/badge";

import { useUnreadMessagesContext } from "@/context/UnreadMessagesContext";

export default function ConversationsLinkContent() {
  const { unreadCounts } = useUnreadMessagesContext();

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