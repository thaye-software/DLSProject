"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "../ui/button";

interface Props {
  onClick: () => void;
  open: boolean;
}

export const FloatingChatButton: React.FC<Props> = ({ onClick, open }) => {
  return (
    <Button
      onClick={onClick}
      aria-label={open ? "Close chat" : "Open chat"}
      className="cursor-pointer fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg hover:shadow-2xl"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
};
