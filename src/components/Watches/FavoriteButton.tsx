"use client";

import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Button } from "../ui/button";
import { Heart } from "lucide-react";
import { handleFavoriteToggle } from "@/services/favoriteService";

export default function FavoriteButton({ productId }: { productId: number }) {
  const { user } = useSupabaseAuth();

  async function handleButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!user || !productId) {
      alert("Please log in to add favorites.");
      return;
    }
    return await handleFavoriteToggle(user.id, productId);
  }

  return (
    <Button
      size="icon"
      variant="secondary"
      className="cursor-pointer opacity-0 group-hover:opacity-100 bg-background/95 shadow-lg"
    onClick={handleButtonClick}
    >
      <Heart />
    </Button>
  );
}