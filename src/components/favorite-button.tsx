"use client";

import { Heart } from "lucide-react";
import { api } from "~/trpc/react";
import { useState } from "react";

interface FavoriteButtonProps {
  projectId: number;
  className?: string;
}

export default function FavoriteButton({ projectId, className = "" }: FavoriteButtonProps) {
  const [isToggling, setIsToggling] = useState(false);
  
  const { data: isFavorite, refetch } = api.projects.isFavorite.useQuery({ projectId });
  const addToFavorites = api.projects.addToFavorites.useMutation();
  const removeFromFavorites = api.projects.removeFromFavorites.useMutation();

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isToggling) return;
    
    setIsToggling(true);
    
    try {
      if (isFavorite) {
        await removeFromFavorites.mutateAsync({ projectId });
      } else {
        await addToFavorites.mutateAsync({ projectId });
      }
      await refetch();
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`w-8 h-8 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-background/90 transition-colors disabled:opacity-50 border border-border ${className}`}
    >
      <Heart 
        className={`w-4 h-4 ${isFavorite ? 'text-gray-500 fill-gray-500' : 'text-foreground'} ${isToggling ? 'animate-pulse' : ''}`} 
      />
    </button>
  );
}
