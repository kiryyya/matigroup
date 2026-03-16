"use client";

import { Heart } from "lucide-react";
import { api } from "~/trpc/react";
import { useState } from "react";
import { cn } from "~/lib/utils";

interface FavoriteButtonProps {
  projectId: number;
  className?: string;
  fullWidth?: boolean;
  label?: string;
}

export default function FavoriteButton({
  projectId,
  className = "",
  fullWidth = false,
  label = "Избранное",
}: FavoriteButtonProps) {
  const [isToggling, setIsToggling] = useState(false);
  const utils = api.useUtils();
  
  const { data: isFavorite } = api.projects.isFavorite.useQuery({ projectId });
  const addToFavorites = api.projects.addToFavorites.useMutation({
    onSuccess: async () => {
      // Инвалидируем и обновляем все связанные запросы
      await utils.projects.isFavorite.invalidate({ projectId });
      await utils.projects.isFavorite.refetch({ projectId });
      await utils.projects.favorites.invalidate();
      await utils.projects.favorites.refetch();
      await utils.projects.allProjects.invalidate();
      await utils.projects.allProjects.refetch();
      await utils.projects.featured.invalidate();
      await utils.projects.featured.refetch();
      // Инвалидируем все категории (без параметров инвалидирует все варианты)
      await utils.projects.projectsByCategory.invalidate();
      // Инвалидируем данные проекта для обновления UI на странице проекта
      await utils.projects.project.invalidate({ id: projectId });
      await utils.projects.project.refetch({ id: projectId });
      await utils.projects.projectFull.invalidate({ id: projectId });
      await utils.projects.projectFull.refetch({ id: projectId });
    },
  });
  const removeFromFavorites = api.projects.removeFromFavorites.useMutation({
    onSuccess: async () => {
      // Инвалидируем и обновляем все связанные запросы
      await utils.projects.isFavorite.invalidate({ projectId });
      await utils.projects.isFavorite.refetch({ projectId });
      await utils.projects.favorites.invalidate();
      await utils.projects.favorites.refetch();
      await utils.projects.allProjects.invalidate();
      await utils.projects.allProjects.refetch();
      await utils.projects.featured.invalidate();
      await utils.projects.featured.refetch();
      // Инвалидируем все категории (без параметров инвалидирует все варианты)
      await utils.projects.projectsByCategory.invalidate();
      // Инвалидируем данные проекта для обновления UI на странице проекта
      await utils.projects.project.invalidate({ id: projectId });
      await utils.projects.project.refetch({ id: projectId });
      await utils.projects.projectFull.invalidate({ id: projectId });
      await utils.projects.projectFull.refetch({ id: projectId });
    },
  });

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
      className={cn(
        "flex items-center justify-center border border-border bg-background/80 backdrop-blur-sm transition-colors hover:bg-background/90 disabled:opacity-50",
        fullWidth ? "h-9 w-full gap-2 rounded-md px-3" : "h-8 w-8 rounded-full",
        className,
      )}
    >
      <Heart 
        className={`w-4 h-4 ${isFavorite ? 'text-gray-500 fill-gray-500' : 'text-foreground'} ${isToggling ? 'animate-pulse' : ''}`} 
      />
      {fullWidth && <span className="text-sm">{label}</span>}
    </button>
  );
}
