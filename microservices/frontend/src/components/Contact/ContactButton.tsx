"use client";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { Button } from "../ui/button";
import { redirect } from "next/navigation";
import { toast } from "sonner";

export default function ContactButton({ productId }: { productId?: string }) {
  const { user } = useSupabaseAuthContext();

  async function handleContactClick() {
    if (!user) {
      redirect("/login");
    }
    // Starting a conversation goes through the gateway in Task 8.
    toast.error("Chat is not available yet.");
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
