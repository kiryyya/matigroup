"use client";

import { api } from "~/trpc/react";
import Loader from "~/components/ui/loader";
import UserSearch from "~/components/user-search";
import Link from "next/link";
import { Button } from "~/components/ui/button";

export default function UsersSettingsPage() {
  const { data: user, isLoading } = api.tg.getUser.useQuery();

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
        <h1 className="text-2xl font-bold">Поиск пользователей</h1>
        <p className="text-muted-foreground">
          Найдите пользователей по имени или email и управляйте их ролями
        </p>
      </div>

      <UserSearch />
    </div>
  );
}
