"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import Link from "next/link";
// Using native img for robust preview rendering (supports data URLs and any origin)
import { Input } from "~/components/ui/input";
import { Search, X } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import FilterModal, { type FilterOptions } from "~/components/filter-modal";
import FavoriteButton from "~/components/favorite-button";
import { useState, useMemo } from "react";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

const categoryNames: Record<string, string> = {
  "real-estate": "Недвижимость",
  "interiors": "Интерьеры", 
  "facades": "Фасады",
  "furniture": "Мебель",
};

const categoryIcons: Record<string, string> = {
  "real-estate": "",
  "interiors": "",
  "facades": "", 
  "furniture": "",
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const { data: projects, isLoading } = api.projects.projectsByCategory.useQuery({
    categorySlug: params.slug,
  });
  // Управление доступом/редактированием перенесено на страницу проекта

  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
    dateRange: 'all'
  });

  const categoryName = categoryNames[params.slug] ?? "Категория";
  const categoryIcon = categoryIcons[params.slug] ?? "📁";

  // Фильтрация и сортировка проектов
  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    let filtered = [...projects];

    // Поиск по названию
    if (filters.searchQuery) {
      filtered = filtered.filter(project =>
        project.title.toLowerCase().includes(filters.searchQuery.toLowerCase())
      );
    }

    // Фильтр по дате
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const dateRanges = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };
      
      const cutoffDate = new Date(now.getTime() - dateRanges[filters.dateRange]);
      filtered = filtered.filter(project => 
        new Date(project.createdAt) >= cutoffDate
      );
    }

    // Сортировка
    filtered.sort((a, b) => {
      if (filters.sortBy === 'date') {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return filters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        return filters.sortOrder === 'asc' 
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA);
      }
    });

    return filtered;
  }, [projects, filters]);

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      sortBy: 'date',
      sortOrder: 'desc',
      dateRange: 'all'
    });
  };

  const clearSearch = () => {
    setFilters(prev => ({ ...prev, searchQuery: '' }));
  };


  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{categoryIcon}</span>
          <h1 className="text-2xl font-bold">{categoryName}</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 pb-52">
      {/* Поиск и фильтры */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Поиск по названию проекта..."
            value={filters.searchQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="pl-10 pr-10"
          />
          {filters.searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <FilterModal
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          projectCount={filteredProjects.length}
        />
      </div>

      {filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="cursor-pointer transition-all hover:shadow-lg relative overflow-hidden aspect-square rounded-2xl">
              <Link href={`/project/${project.id}`} className="block">
                {project.images && project.images.length > 0 ? (
                  <>
                    {/* Фоновое изображение */}
                    <div className="absolute inset-0 z-0">
                      <img
                        src={project.images?.[0] ?? ''}
                        alt={project.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlByZXZpZXc8L3RleHQ+PC9zdmc+';
                        }}
                      />
                      {/* Темный оверлей для лучшей читаемости текста */}
                      <div className="absolute inset-0 bg-black/30" />
                    </div>
                    
                    {/* Нижний градиент с названием */}
                    <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-10 bg-gradient-to-t from-black/80 to-transparent">
                      <CardTitle className="text-white line-clamp-2">{project.title}</CardTitle>
                    </div>

                    {/* Кнопка избранного справа сверху */}
                    <div className="absolute top-2 right-2 z-20">
                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <FavoriteButton projectId={project.id} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Плейсхолдер без изображения */}
                    <div className="absolute inset-0 bg-muted" />
                    <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-10 bg-gradient-to-t from-black/80 to-transparent">
                      <CardTitle className="text-white line-clamp-2">{project.title}</CardTitle>
                    </div>
                  </>
                )}
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl mb-4">{categoryIcon}</span>
            <h3 className="text-lg font-semibold mb-2">
              {projects && projects.length > 0 ? 'Ничего не найдено' : 'Пока нет проектов'}
            </h3>
            <p className="text-muted-foreground text-center">
              {projects && projects.length > 0 
                ? 'Попробуйте изменить параметры поиска или фильтры'
                : 'В этой категории пока нет опубликованных проектов'
              }
            </p>
            {projects && projects.length > 0 && (
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                className="mt-4"
              >
                Очистить фильтры
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}
