"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import Link from "next/link";
import { Skeleton } from "~/components/ui/skeleton";

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
  "real-estate": "🏠",
  "interiors": "🎨",
  "facades": "🏢", 
  "furniture": "🪑",
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const { data: projects, isLoading } = api.projects.projectsByCategory.useQuery({
    categorySlug: params.slug,
  });

  const categoryName = categoryNames[params.slug] || "Категория";
  const categoryIcon = categoryIcons[params.slug] || "📁";

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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{categoryIcon}</span>
        <h1 className="text-2xl font-bold">{categoryName}</h1>
        <Badge variant="secondary">{projects?.length || 0} проектов</Badge>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/project/${project.id}`}>
              <Card className="cursor-pointer transition-all hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{project.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {project.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {project.images && project.images.length > 0 ? (
                    <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                      <img
                        src={project.images[0]}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full rounded-md bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground">Нет изображения</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="outline">
                      {project.category?.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl mb-4">{categoryIcon}</span>
            <h3 className="text-lg font-semibold mb-2">Пока нет проектов</h3>
            <p className="text-muted-foreground text-center">
              В этой категории пока нет опубликованных проектов
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
