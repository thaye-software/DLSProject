import { cn } from "@/lib/tailwindUtils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UIConversation } from "./ConversationDashboard";


export default function ChatListItem({
  chat,
  isSelected,
  onClick,
  compact = false,
  userId,
}: {
  chat: UIConversation;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
  userId: string;
}) {

  const isYou = chat.lastMessageSenderId === userId;
  const senderPrefix = isYou ? "You: " : `${chat.customerName}: `;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent w-full max-w-full",
        isSelected && "bg-accent border-primary/20 shadow-sm",
        compact && "border-0 p-2 bg-transparent hover:bg-muted"
      )}
    >
      <div className="flex w-full flex-col gap-1 overflow-hidden">
        {!compact && chat.productName && (
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold text-xs text-muted-foreground truncate">
              Regarding: {chat.productName}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs whitespace-nowrap",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {formatTimeAgo(chat.lastMessageAt)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 w-full">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px]">
              {chat.customerInitials}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium truncate flex-1 min-w-0">
            {chat.customerName}
          </span>
          {chat.unreadCount > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-blue-600 shrink-0" />
          )}
          {(compact || !chat.productName) && (
            <span
              className={cn(
                "shrink-0 text-xs whitespace-nowrap",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {formatTimeAgo(chat.lastMessageAt)}
            </span>
          )}
        </div>

        <div className="line-clamp-2 text-xs text-muted-foreground mt-1 w-full wrap-break-word">
          <span className="font-semibold text-foreground/80">{senderPrefix}</span>
          {chat.lastMessageContent.substring(0, 100)}
        </div>
      </div>
    </button>
  );
}

//---------------------------------------- helper functions ----------------------------------------

function formatTimeAgo(date: Date) {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const interval = seconds / 31536000; // 1 year in seconds

  if (interval > 1) return Math.floor(interval) + "y ago";
  const months = seconds / 2592000;

  if (months > 1) return Math.floor(months) + "mo ago";
  const days = seconds / 86400;

  if (days > 1) return Math.floor(days) + "d ago";
  const hours = seconds / 3600;

  if (hours > 1) return Math.floor(hours) + "h ago";
  const minutes = seconds / 60;

  if (minutes > 1) return Math.floor(minutes) + "m ago";

  return "just now";
}