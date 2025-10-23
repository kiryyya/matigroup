"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Link from "next/link";
import { ArrowLeft, Calendar, User } from "lucide-react";

interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { data: project, isLoading } = api.projects.project.useQuery({
    id: parseInt(params.id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Проект не найден</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl mb-4">❌</span>
            <h3 className="text-lg font-semibold mb-2">Проект не найден</h3>
            <p className="text-muted-foreground text-center">
              Запрашиваемый проект не существует или был удален
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/category/${project.category?.slug || ''}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к категории
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{project.category?.name}</Badge>
              {project.featured && (
                <Badge variant="default">⭐ Рекомендуемый</Badge>
              )}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Описание проекта</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <p className="text-muted-foreground">{project.description}</p>
            )}
            
            {project.content && (
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: project.content }} />
              </div>
            )}

            {project.images && project.images.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Изображения</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {project.images.map((image, index) => (
                    <div key={index} className="aspect-video overflow-hidden rounded-md">
                      <img
                        src={image}
                        alt={`${project.title} - изображение ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{project.user?.name || 'Автор'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
