"use client";

import React, { useEffect } from "react";
import { RealtimeChat } from "./RealtimeChat";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { Item } from "../ui/item";
import Image from "next/image";
import Link from "next/link";

export const ChatPanel: React.FC<{
  user: any;
  username: string;
  conversations: any[];
  selectedConversation: any | null;
  setSelectedConversation: (convId: string | null) => void;
  onClose?: () => void;
}> = ({
  user,
  username,
  conversations,
  selectedConversation,
  setSelectedConversation,
  onClose,
}) => {
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

                <div
                  className="gap-2 flex flex-col ml-3 min-w-0"
                >
                  {/* product name */}
                  <div className="font-bold text-lg truncate">
                    {conv.product.name}
                  </div>

                  {/* message row */}
                  <div className="flex items-center w-full gap-2 min-w-0">
                    {/* message preview */}
                    <div className="flex items-center min-w-0">
                      {/* sender */}
                      {conv.messages[0].sender?.id === user?.id ? (
                        <span className="font-bold mr-1">You:</span>
                      ) : (
                        <span className="font-bold mr-1">
                          {conv.messages[0].senderType.toLowerCase() === "seller" ? conv.messages[0].sender.username : "User"}
                        </span>
                      )}

                      {/* content */}
                      <span
                        className={`${
                          !conv.messages[0].isRead &&
                          conv.messages[0].sender?.id !== user?.id
                            ? "font-bold"
                            : ""
                        } truncate block max-w-[22ch]`}
                      >
                        {conv.messages[0]?.content ? conv.messages[0]?.content : "No messages"}
                      </span>
                    </div>

                    {/* date */}
                    <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(conv.messages[0].createdAt).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
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
          userId={user?.id}
          username={username}
          messages={selectedConversation.messages}
        />
      </div>
    </div>
  );
};
