"use client";

import React, { useEffect } from "react";
import { RealtimeChat } from "./RealtimeChat";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { Item } from "../ui/item";
import Image from "next/image";
import { userService } from "@/services/userService";

export const ChatPanel: React.FC<{
  rooms: any[];
  selectedRoom: any | null;
  setSelectedRoom: (roomId: string | null) => void;
  onClose?: () => void;
}> = ({ rooms, selectedRoom, setSelectedRoom, onClose }) => {
  const { user } = useSupabaseAuth();

  useEffect(() => {
    console.log("ChatPanel selectedRoom:", selectedRoom);
  }, [selectedRoom]);

  // UI: if no room selected show the rooms list full-width; if selected show the room full-width with back button
  if (!selectedRoom) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col mt-2 px-2">
            {rooms.map((room) => (
              <Item
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className="flex p-0 text-left w-full rounded-2xl text-sm cursor-pointer hover:bg-accent"
              >
                <Image
                  src={
                    room.product.productImages[0].imageUrl ||
                    "/images/placeholder.png"
                  }
                  alt={room.product.name}
                  width={80}
                  height={80}
                  className="rounded-2xl h-full aspect-square object-cover"
                  unoptimized
                />
                <div className="gap-2 flex flex-col justify-center flex-1">
                  <div>
                    <span className="font-bold text-lg mr-1">{room.product.name}</span>
                    <span className="text-xs text-muted-foreground">ref: {room.product.watch.reference}</span>
                  </div>
                  
                  <div>
                    {room.messages && room.messages.length > 0 ? (
                      <div className="text-xs text-foreground/70">
                        {/* TODO: fix this so it displays correctly. we need userid from supabase for it to work */}
                        {room.messages[0].sender?.senderId === user?.id ? (
                          <span className="font-bold">You: </span>
                        ) : (
                          <span className="font-bold">Seller: </span>
                        )}
                        <span
                          className="inline-block align-middle max-w-45 truncate"
                          title={String(room.messages[0]?.content ?? "")}
                        >
                          {room.messages[0]?.content}
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
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex-1">
        <RealtimeChat
          roomName={selectedRoom}
          // userId={user?.id ?? "guest"}
          username={user?.email ?? "guest"}
          messages={selectedRoom.messages}
        />
      </div>
    </div>
  );
};
