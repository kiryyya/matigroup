"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Plus, Search } from "lucide-react";
import CreateProjectModal from "~/components/create-project-modal";
import UserSearchModal from "~/components/user-search-modal";
import { useModal } from "~/contexts/modal-context";
import { useState } from "react";

export default function Settings() {
  const { data: user, isLoading } = api.tg.getUser.useQuery();
  const { isModalOpen, setIsModalOpen } = useModal();
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Настройки</h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-52">
      <h1 className="text-2xl font-bold">Настройки</h1>

      {/* Поиск пользователей */}
      <Card>
        <CardHeader>
          <CardTitle>Поиск пользователей</CardTitle>
          <CardDescription>
            Найдите пользователей по имени или email и посмотрите их роль
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setIsUserSearchOpen(true)}
            className="w-full"
            size="lg"
            variant="outline"
          >
            <Search className="h-4 w-4 mr-2" />
            Открыть поиск пользователей
          </Button>
        </CardContent>
      </Card>

      {/* Кнопка создания проекта */}
      <Card>
        <CardHeader>
          <CardTitle>Управление проектами</CardTitle>
          <CardDescription>
            Создавайте и управляйте проектами
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

      {/* Модальное окно поиска пользователей */}
      <UserSearchModal 
        isOpen={isUserSearchOpen}
        onClose={() => setIsUserSearchOpen(false)}
      />
    </div>
  );
}