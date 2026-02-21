"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import Loader from "~/components/ui/loader";
import { Heart, Calendar, User, MapPin } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";

export default function FavoritesPage() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = api.projects.favorites.useInfiniteQuery(
    {
      limit: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Объединяем все страницы в один массив
  const favorites = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const utils = api.useUtils();

  // Ref для элемента, который будет триггерить загрузку следующей страницы
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection Observer для автоматической подгрузки
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const removeFromFavorites = api.projects.removeFromFavorites.useMutation({
    onSuccess: async () => {
      // Инвалидируем и обновляем все связанные запросы
      await utils.projects.favorites.invalidate();
      await utils.projects.favorites.refetch();
      await utils.projects.isFavorite.invalidate();
      await utils.projects.allProjects.invalidate();
      await utils.projects.allProjects.refetch();
      await utils.projects.featured.invalidate();
      await utils.projects.featured.refetch();
      // Инвалидируем все категории (без параметров инвалидирует все варианты)
      await utils.projects.projectsByCategory.invalidate();
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
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
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
              Добавьте проекты в избранное, нажав на сердечко в карточке проекта
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
                    <img
                      src={project.images[0]?.previewUrl ?? project.images[0]?.url ?? ""}
                      alt={project.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  </div>
                </CardContent>
              )}
            </Link>
          </Card>
        ))}
      </div>
      
      {/* Элемент для триггера загрузки следующей страницы */}
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
        {isFetchingNextPage && <Loader />}
      </div>
    </div>
  );
}
