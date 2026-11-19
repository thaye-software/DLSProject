"use client";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { useChatContext } from "@/context/ChatContext";
import { openConversation } from "@/app/chat/actions";
import { Button } from "../ui/button";
import { redirect } from "next/navigation";
import { toast } from "sonner";

export default function ContactButton({ productId }: { productId: string }) {
  const { user } = useSupabaseAuthContext();
  const { setChatOpen, setConversations, setSelectedConversation } = useChatContext();

  async function handleContactClick() {
    if (!user) {
      redirect("/login");
    }
    const r = await openConversation(productId);
    if (!r.ok) return void toast.error(r.error);
    const conv = r.data;
    setConversations((prev) => [conv, ...prev.filter((c) => c.conversation_id !== conv.conversation_id)]);
    setSelectedConversation(conv);
    setChatOpen(true);
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
