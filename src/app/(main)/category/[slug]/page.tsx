"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import Link from "next/link";
// Using native img for robust preview rendering (supports data URLs and any origin)
import { Input } from "~/components/ui/input";
import { Search, X } from "lucide-react";
import FilterModal, { type FilterOptions } from "~/components/filter-modal";
import FavoriteButton from "~/components/favorite-button";
import Loader from "~/components/ui/loader";
import { useState, useMemo, useEffect, useRef } from "react";
import type { StoredImage } from "~/types/files";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

const categoryIcons: Record<string, string> = {
  "real-estate": "",
  "interiors": "",
  "facades": "", 
  "furniture": "",
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const { data: categoryData } = api.categories.getBySlug.useQuery({ slug: params.slug });
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = api.projects.projectsByCategory.useInfiniteQuery(
    {
      categorySlug: params.slug,
      limit: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Объединяем все страницы в один массив
  const projects = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  // Управление доступом/редактированием перенесено на страницу проекта

  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
    dateRange: 'all',
    categoryValues: {},
  });

  const categoryIcon = categoryData?.icon ?? categoryIcons[params.slug] ?? "📁";
  const categoryFilters = categoryData?.filters ?? [];
  const quickFilterItems = useMemo(
    () =>
      categoryFilters
        .flatMap((filter) =>
          (filter.options ?? []).map((rawValue, index) => ({
            key: `${filter.id}-${index}`,
            id: filter.id,
            value: rawValue.trim(),
          })),
        )
        .filter((item) => item.value.length > 0),
    [categoryFilters],
  );

  // Ref для элемента, который будет триггерить загрузку следующей страницы
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection Observer для автоматической подгрузки
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
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

  // Фильтрация и сортировка проектов
  const filteredProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];

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

    // Фильтры категории
    const activeCategoryFilters = Object.entries(filters.categoryValues).filter(
      ([, value]) => Boolean(value),
    );
    if (activeCategoryFilters.length > 0) {
      filtered = filtered.filter((project) => {
        const projectFilterValues = project.filterValues ?? {};
        return activeCategoryFilters.every(
          ([filterId, selectedValue]) =>
            projectFilterValues[filterId] === selectedValue,
        );
      });
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
      dateRange: 'all',
      categoryValues: {},
    });
  };

  const clearSearch = () => {
    setFilters(prev => ({ ...prev, searchQuery: '' }));
  };

  const setQuickCategoryFilter = (filterId: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      categoryValues: {
        // Быстрые фильтры работают как единый переключатель "как категории"
        // поэтому оставляем только одно активное значение.
        [filterId]: value,
      },
    }));
  };

  const clearQuickCategoryFilters = () => {
    setFilters((prev) => ({
      ...prev,
      categoryValues: {},
    }));
  };

  const encodeStorageKey = (key: string) =>
    key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

  const buildImageProxyUrl = (key: string) =>
    `/api/images/${encodeStorageKey(key)}?v=desktop-cache-bust-3`;

  const getPreviewKey = (key: string) => {
    if (key.includes("-original-")) return key.replace("-original-", "-preview-");
    if (key.includes("original")) return key.replace("original", "preview");
    return key;
  };

  const getImageCandidates = (image: StoredImage) => {
    const candidates = [
      image?.previewUrl ?? "",
      image?.url ?? "",
      image?.key ? buildImageProxyUrl(image.key) : "",
      image?.key ? buildImageProxyUrl(getPreviewKey(image.key)) : "",
    ].filter(Boolean);

    return [...new Set(candidates)];
  };


  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
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
          categoryFilters={categoryFilters}
        />
      </div>

      {quickFilterItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Button
            type="button"
            variant={Object.keys(filters.categoryValues).length === 0 ? "default" : "outline"}
            size="sm"
            onClick={clearQuickCategoryFilters}
            className="whitespace-nowrap rounded-full"
          >
            Все
          </Button>
          {quickFilterItems.map((item) => {
            const activeValue = filters.categoryValues[item.id];
            const isActive = activeValue === item.value;
            return (
              <Button
                key={item.key}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  isActive
                    ? clearQuickCategoryFilters()
                    : setQuickCategoryFilter(item.id, item.value)
                }
                className="whitespace-nowrap rounded-full"
              >
                {item.value}
              </Button>
            );
          })}
        </div>
      )}

      {filteredProjects && filteredProjects.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="cursor-pointer transition-all hover:shadow-lg relative overflow-hidden aspect-square rounded-2xl">
                <Link href={`/project/${project.id}`} className="block">
                  {project.images && project.images.length > 0 ? (
                    <>
                      {/* Фоновое изображение */}
                      <div className="absolute inset-0 z-0">
                        <img
                          src={getImageCandidates(project.images?.[0] as StoredImage)[0] ?? ""}
                          alt={project.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const image = project.images?.[0] as StoredImage;
                            const candidates = getImageCandidates(image);
                            const fallbackIndex = Number(target.dataset.fallbackIndex ?? "0");
                            const nextSrc = candidates[fallbackIndex + 1];
                            if (nextSrc) {
                              target.dataset.fallbackIndex = String(fallbackIndex + 1);
                              target.src = nextSrc;
                              return;
                            }
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
          
          {/* Элемент для триггера загрузки следующей страницы */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
            {isFetchingNextPage && <Loader />}
          </div>
        </>
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
