"use client";

import React from "react";
import { RealtimeChat } from "./RealtimeChat";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { Item } from "../ui/item";
import { Room } from "./ChatBox";

export const ChatPanel: React.FC<{
  rooms: Room[];
  selectedRoom: string | null;
  setSelectedRoom: (roomId: string | null) => void;
  onClose?: () => void;
}> = ({ rooms, selectedRoom, setSelectedRoom, onClose }) => {
  const { user } = useSupabaseAuth();

  // UI: if no room selected show the rooms list full-width; if selected show the room full-width with back button
  if (!selectedRoom) {
    return (
      <div className="flex h-full w-full flex-col bg-background p-4">
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2">
            {rooms.map((room) => (
              <Item
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className="text-left w-full text-sm cursor-pointer hover:bg-accent"
              >
                <div className="font-medium">{room.productId}</div>
                {room.lastMessage ? (
                  <div className="text-xs text-muted-foreground">
                    {room.lastMessage}
                  </div>
                ) : null}
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
          username={user?.email ?? "guest"}
        />
      </div>
    </div>
  );
};
