"use client";

import React, { useCallback } from "react";
import { RealtimeChat } from "./RealtimeChat";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { useChatContext } from "@/context/ChatContext";
import { Item } from "../ui/item";
import Image from "next/image";
import Link from "next/link";
import type { ChatMessage } from "@/hooks/useRealtimeChat";
import type { Conversation } from "@/services/conversationService";

export const ChatPanel: React.FC<{
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  setSelectedConversation: (conv: Conversation | null) => void;
}> = ({ conversations, selectedConversation, setSelectedConversation: selectConversation }) => {
  const { user } = useSupabaseAuthContext();
  const { setConversations, setSelectedConversation } = useChatContext();

  // Keep the list preview in sync with messages sent or received in the open chat
  const handleMessageReceived = useCallback(
    (message: ChatMessage) => {
      const touch = (c: Conversation) =>
        c.conversation_id === message.conversation_id ? { ...c, last_message: message } : c;
      setConversations((prev) => prev.map(touch));
      setSelectedConversation((prev) => prev && touch(prev));
    },
    [setConversations, setSelectedConversation],
  );

  const handleRead = useCallback(
    () =>
      setConversations((prev) =>
        prev.map((c) => (c.conversation_id === selectedConversation?.conversation_id ? { ...c, unread_count: 0 } : c)),
      ),
    [setConversations, selectedConversation?.conversation_id],
  );

  // UI: if no conv selected show the convs list full-width; if selected show the conv full-width with back button
  if (!selectedConversation) {
    return (
      <div className="flex h-full w-full flex-col bg-background min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex flex-col mt-2 px-2 gap-2">
            {conversations.map((conv) => (
              <Item
                key={conv.conversation_id}
                className="flex p-0 text-left w-full rounded-2xl text-sm cursor-pointer hover:bg-accent flex-nowrap items-start"
                onClick={() => selectConversation(conv)}
              >
                {/* the watch page redirects an unknown slug to the right one */}
                <Link
                  href={`/watches/view/${conv.product_id}/_`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Image
                    src={conv.thumbnail_url || "/sadly-no-image.png"}
                    alt={conv.product_name}
                    width={80}
                    height={80}
                    className="rounded-2xl h-full aspect-square object-cover shrink-0"
                    unoptimized
                  />
                </Link>

                <div className="gap-2 flex flex-col ml-3 min-w-0">
                  <div className="font-bold text-lg truncate">{conv.product_name}</div>

                  <div className="flex items-center w-full gap-2 min-w-0">
                    <div className="flex items-center min-w-0">
                      {conv.last_message && (
                        <span className="font-bold mr-1">
                          {conv.last_message.sender_user_id === user?.id ? "You:" : "Seller:"}
                        </span>
                      )}
                      <span
                        className={`${conv.unread_count > 0 ? "font-bold" : ""} truncate block max-w-[22ch]`}
                      >
                        {conv.last_message?.content ?? "No messages"}
                      </span>
                    </div>

                    {conv.last_message && (
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(conv.last_message.created_at).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </Item>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background min-h-0">
      <div className="flex-1 min-h-0">
        <RealtimeChat
          key={selectedConversation.conversation_id}
          conversation={selectedConversation}
          userId={user?.id || ""}
          onMessageReceived={handleMessageReceived}
          onRead={handleRead}
        />
      </div>
    </div>
  );
};
