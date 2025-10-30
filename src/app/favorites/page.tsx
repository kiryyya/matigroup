"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Heart, Calendar, User, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function FavoritesPage() {
  const { data: favorites, isLoading } = api.projects.favorites.useQuery();
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());

  const removeFromFavorites = api.projects.removeFromFavorites.useMutation({
    onSuccess: () => {
      // Refetch favorites after successful removal
      window.location.reload();
    },
  });

  const handleRemoveFromFavorites = async (projectId: number) => {
    setRemovingIds(prev => new Set(prev).add(projectId));
    try {
      await removeFromFavorites.mutateAsync({ projectId });
    } catch (error) {
      console.error("Error removing from favorites:", error);
    } finally {
      setRemovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Избранное</h1>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!favorites || favorites.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Избранное</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Пока пусто</h3>
            <p className="text-gray-600 text-center">
              Добавьте проекты в избранное, нажав на сердечко
            </p>
            <Link 
              href="/"
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Перейти к проектам
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-52">
      <h1 className="text-2xl font-bold">Избранное</h1>
      <p className="text-gray-600">
        {favorites.length} {favorites.length === 1 ? 'проект' : 'проектов'} в избранном
      </p>
      
      <div className="grid gap-4">
        {favorites.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition-shadow">
            <Link href={`/project/${project.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{project.title}</CardTitle>
                    <CardDescription className="mb-3">
                      {project.description}
                    </CardDescription>
                    
                    {/* Category Badge */}
                    <Badge variant="secondary" className="mb-3">
                      {project.category?.icon} {project.category?.name}
                    </Badge>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {project.user?.name || 'Автор'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(project.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Remove from favorites button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveFromFavorites(project.id);
                    }}
                    disabled={removingIds.has(project.id)}
                    className="ml-4 p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors disabled:opacity-50"
                  >
                    <Heart className={`h-5 w-5 ${removingIds.has(project.id) ? 'animate-pulse' : ''}`} fill="currentColor" />
                  </button>
                </div>
              </CardHeader>
              
              {project.images && project.images.length > 0 && project.images[0] && (
                <CardContent>
                  <div className="relative h-48 w-full rounded-lg overflow-hidden">
                    <Image
                      src={project.images[0]}
                      alt={project.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                </CardContent>
              )}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
