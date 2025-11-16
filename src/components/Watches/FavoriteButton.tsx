"use client";

import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Button } from "../ui/button";
import { Heart } from "lucide-react";
import { isFavorite, handleFavoriteToggle } from "@/services/favoriteService";
import { useState } from "react";
import { toast } from "sonner";

export default function FavoriteButton({ productId }: { productId: number }) {
  const { user } = useSupabaseAuth();
  const [favorited, setFavorited] = useState(false);

  async function isFavorited() {
    if (!user) return;
    const favoritedStatus = await isFavorite(user.id, productId);
    setFavorited(favoritedStatus);
  }


  async function handleButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!user || !productId) {
      alert("Please log in to add favorites.");
      return;
    }
    setFavorited(!favorited);
    toast.success(favorited ? "Removed from favorites" : "Added to favorites");
    return await handleFavoriteToggle(user.id, productId);
  }

  return (
    <Button
      size="icon"
      variant="secondary"
      className="cursor-pointer opacity-0 group-hover:opacity-100 bg-background/95 shadow-lg"
      onClick={handleButtonClick}
    >
      <Heart className={favorited ? "fill-primary" : ""} />
    </Button>
  );
}