"use client";

import React, { useEffect } from "react";
import { RealtimeChat } from "./RealtimeChat";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { Item } from "../ui/item";
import Image from "next/image";

export const ChatPanel: React.FC<{
  user: any;
  username: string;
  conversations: any[];
  selectedConversation: any | null;
  setSelectedConversation: (convId: string | null) => void;
  onClose?: () => void;
}> = ({ user, username, conversations, selectedConversation, setSelectedConversation, onClose }) => {

  // UI: if no conv selected show the convs list full-width; if selected show the conv full-width with back button
  if (!selectedConversation) {
    return (
      <div className="flex h-full w-full flex-col bg-background min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex flex-col mt-2 px-2">
            {conversations.map((conv) => (
              <Item
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className="flex p-0 text-left w-full rounded-2xl text-sm cursor-pointer hover:bg-accent"
              >
                <Image
                  src={
                    conv.product.productImages[0].imageUrl ||
                    "/images/placeholder.png"
                  }
                  alt={conv.product.name}
                  width={80}
                  height={80}
                  className="rounded-2xl h-full aspect-square object-cover"
                  unoptimized
                />
                <div className="gap-2 flex flex-col justify-center flex-1">
                  <div>
                    <span className="font-bold text-lg mr-1">
                      {conv.product.name}
                    </span>
                    {/* <span className="text-xs text-muted-foreground">
                      ref: {conv  .product.watch.reference}
                    </span> */}
                  </div>

                  <div>
                    {conv.messages && conv.messages.length > 0 ? (
                      <div className="text-xs text-foreground/70">
                        {conv.messages[0].sender?.id === user?.id && (
                          <span className="font-bold">You: </span>
                        )}
                        <span
                          className={`${!conv.messages[0].isRead && conv.messages[0].sender?.id !== user?.id ? "font-bold" : ""} inline-block align-middle max-w-45 truncate`}
                        >
                          {conv.messages[0]?.content}
                        </span>
                      </div>
                    ) : (
                      <div />
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
          userId={user?.id}
          username={username}
          messages={selectedConversation.messages}
        />
      </div>
    </div>
  );
};
