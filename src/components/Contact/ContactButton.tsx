"use client";

import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Button } from "../ui/button";
import { redirect } from "next/navigation";
import { createConversation } from "@/services/conversationService";
import { useChatContext } from "@/context/ChatContext";

export default function ContactButton({ productId }: { productId?: number }) {
  const { user } = useSupabaseAuth();
  const { setChatOpen, setInitialConversation } = useChatContext();

  async function handleContactClick() {
    if (!user) {
      redirect("/login");
    }
    if (productId) {
      const newConversation = await createConversation(user.id, productId);
      setInitialConversation(newConversation);
      setChatOpen(true);
    }
  }

  return (
    <Button
      variant="outline"
      className={`hover:cursor-pointer h-12 font-bold py-4 px-8 transition-all`}
      onClick={handleContactClick}
    >
      Contact Us
    </Button>
  );
}
