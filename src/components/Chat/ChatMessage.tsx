"use client";

import { cn } from "@/lib/tailwindUtils";
import type { ChatMessage } from "@/hooks/use-realtime-chat";
import { Button } from "@/components/ui/button";

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showHeader: boolean;
}

export const ChatMessageItem = ({
  message,
  isOwnMessage,
  showHeader,
}: ChatMessageItemProps) => {
  return (
    <div
      className={`flex mt-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}
    >
      <div
        className={cn("max-w-[75%] min-w-0 flex flex-col gap-1", {
          "items-end": isOwnMessage,
        })}
      >
        {showHeader && (
          <div
            className={cn("flex items-center gap-2 text-xs px-3", {
              "justify-end flex-row-reverse": isOwnMessage,
            })}
          >
            <span className={"font-medium"}>
              {isOwnMessage ? "You" : message.sender.username}
            </span>
            <span className="text-foreground/50 text-xs">
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={cn(
            "py-2 px-3 rounded-xl text-sm w-fit max-w-full",
            "wrap-break-word whitespace-pre-wrap overflow-hidden",
            isOwnMessage
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-foreground"
          )}
        >
          {renderMessageContent(message.content)}
        </div>
      </div>
    </div>
  );
};

function renderMessageContent(content: string) {
  // Find URLs (absolute http(s) or relative paths starting with /) and render anchors
  const urlRegex = /(https?:\/\/[^\s]+|\/[^\s]+)/g;
  const parts: Array<string | { url: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(content)) !== null) {
    const idx = match.index;
    if (idx > lastIndex) {
      parts.push(content.substring(lastIndex, idx));
    }
    parts.push({ url: match[0] });
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  if (parts.length === 0) return content;

  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === "string") {
          return <span key={i}>{p}</span>;
        }

        // Check if it's an offer link
        if (
          p.url.includes("/orders/checkout/infomation") &&
          p.url.includes("offer=")
        ) {
          return (
            <div key={i} className="mt-2">
              <a href={p.url} className="no-underline">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full font-bold"
                >
                  Accept Offer
                </Button>
              </a>
            </div>
          );
        }

        return (
          <a
            key={i}
            href={p.url}
            className="text-blue-500 underline"
            target={p.url.startsWith("http") ? "_blank" : undefined}
            rel={p.url.startsWith("http") ? "noreferrer" : undefined}
          >
            {p.url}
          </a>
        );
      })}
    </>
  );
}
