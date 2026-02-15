"use client";

import { api } from "~/trpc/react";
import Loader from "~/components/ui/loader";
import CreateProjectModal from "~/components/create-project-modal";
import { useModal } from "~/contexts/modal-context";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Plus } from "lucide-react";

export default function ProjectsSettingsPage() {
  const { data: user, isLoading } = api.tg.getUser.useQuery();
  const { isModalOpen, setIsModalOpen } = useModal();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="space-y-4 pb-52">
        <h1 className="text-2xl font-bold">Доступ запрещен</h1>
        <p className="text-muted-foreground">У вас нет прав для доступа к этой странице.</p>
        <Link href="/settings">
          <Button variant="outline">
            Вернуться в настройки
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-52">
      <div>
        <h1 className="text-2xl font-bold">Управление проектами</h1>
        <p className="text-muted-foreground">
          Создавайте и управляйте проектами
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Создать новый проект</CardTitle>
          <CardDescription>
            Добавьте новый проект с изображениями, описанием и вложениями
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="w-full"
            size="lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать новый проект
          </Button>
        </CardContent>
      </Card>

      {/* Модальное окно создания проекта */}
      <CreateProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
