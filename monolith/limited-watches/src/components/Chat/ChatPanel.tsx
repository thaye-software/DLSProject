"use client";

import React, { useCallback } from "react";
import { RealtimeChat } from "./RealtimeChat";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { useChatContext } from "@/context/ChatContext";
import { Item } from "../ui/item";
import Image from "next/image";
import Link from "next/link";
import { ChatMessage } from "@/hooks/useRealtimeChat";

export const ChatPanel: React.FC<{
  conversations: any[];
  selectedConversation: any | null;
  setSelectedConversation: (convId: string | null) => void;
}> = ({ conversations, selectedConversation, setSelectedConversation }) => {
  const { user, username } = useSupabaseAuthContext();
  const { setConversations, setSelectedConversation: setSelectedConv } =
    useChatContext();

  // Update the conversation's messages when a new message is sent/received
  const handleMessageReceived = useCallback(
    (message: ChatMessage) => {
      if (!message.conversationId) return;

      // Update the conversations list with the new message
      setConversations((prevConversations: any[]) =>
        prevConversations.map((conv) => {
          if (conv.id === message.conversationId) {
            // Check if message already exists
            const messageExists = conv.messages.some(
              (m: any) => m.id === message.id
            );
            if (messageExists) return conv;

            // Add new message to the beginning (for preview) and sort by date
            const updatedMessages = [message, ...conv.messages];
            updatedMessages.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            );
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        })
      );

      // Also update the selected conversation if it's the same one
      if (selectedConversation?.id === message.conversationId) {
        setSelectedConv((prev: any) => {
          if (!prev || prev.id !== message.conversationId) return prev;
          const messageExists = prev.messages.some(
            (m: any) => m.id === message.id
          );
          if (messageExists) return prev;

          const updatedMessages = [...prev.messages, message];
          updatedMessages.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          return { ...prev, messages: updatedMessages };
        });
      }
    },
    [setConversations, setSelectedConv, selectedConversation?.id]
  );

  // UI: if no conv selected show the convs list full-width; if selected show the conv full-width with back button
  if (!selectedConversation) {
    return (
      <div className="flex h-full w-full flex-col bg-background min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex flex-col mt-2 px-2 gap-2">
            {conversations.map((conv) => (
              <Item
                key={conv.id}
                className="flex p-0 text-left w-full rounded-2xl text-sm cursor-pointer hover:bg-accent flex-nowrap items-start"
                onClick={() => setSelectedConversation(conv)}
              >
                <Link
                  href={`/watches/view/${conv.product.watch.slug}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Image
                    src={
                      conv.product.productImages[0].imageUrl ||
                      "/images/placeholder.png"
                    }
                    alt={conv.product.name}
                    width={80}
                    height={80}
                    className="rounded-2xl h-full aspect-square object-cover shrink-0"
                    unoptimized
                  />
                </Link>

                <div className="gap-2 flex flex-col ml-3 min-w-0">
                  {/* product name */}
                  <div className="font-bold text-lg truncate">
                    {conv.product.name}
                  </div>

                  {/* message row */}
                  <div className="flex items-center w-full gap-2 min-w-0">
                    {/* message preview */}
                    <div className="flex items-center min-w-0">
                      {/* sender */}
                      {conv.messages[0] === undefined ? (
                        <div></div>
                      ) : conv.messages[0]?.sender?.id === user?.id ? (
                        <span className="font-bold mr-1">You:</span>
                      ) : (
                        <span className="font-bold mr-1">
                          {conv.messages[0]?.senderType.toLowerCase() ===
                          "seller"
                            ? conv.messages[0]?.sender?.username
                            : "User"}
                        </span>
                      )}

                      {/* content */}
                      <span
                        className={`${
                          !conv.messages[0]?.isRead &&
                          conv.messages[0]?.sender?.id !== user?.id
                            ? "font-bold"
                            : ""
                        } truncate block max-w-[22ch]`}
                      >
                        {conv.messages[0]?.content
                          ? conv.messages[0]?.content
                          : "No messages"}
                      </span>
                    </div>

                    {/* date */}
                    {conv.messages[0]?.createdAt && (
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(
                          conv.messages[0]?.createdAt
                        ).toLocaleDateString("en-GB", {
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
          conversation={selectedConversation}
          userId={user?.id || ""}
          username={username || "Unknown User"}
          messages={selectedConversation.messages}
          onMessageReceived={handleMessageReceived}
        />
      </div>
    </div>
  );
};
