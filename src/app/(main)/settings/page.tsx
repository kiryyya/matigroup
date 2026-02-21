"use client";

import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import Loader from "~/components/ui/loader";
import Link from "next/link";
import { Search, Plus, Image as ImageIcon, ChevronRight, Folder } from "lucide-react";

export default function Settings() {
  const { data: user, isLoading } = api.tg.getUser.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  // Отладка: логируем данные пользователя
  console.log("Settings page - user data:", user);
  console.log("Settings page - user role:", user?.role);
  console.log("Settings page - is admin?", user?.role === "admin");

  const settingsItems = [
    {
      title: "Поиск пользователей",
      description: "Найдите пользователей по имени или email и управляйте их ролями",
      href: "/settings/users",
      icon: Search,
      adminOnly: true,
    },
    {
      title: "Управление проектами",
      description: "Создавайте и управляйте проектами",
      href: "/settings/projects",
      icon: Plus,
      adminOnly: true,
    },
    {
      title: "Управление категориями",
      description: "Создавайте, редактируйте и удаляйте категории проектов",
      href: "/settings/categories",
      icon: Folder,
      adminOnly: true,
    },
    {
      title: "Настройки водяного знака",
      description: "Настройте параметры водяного знака для изображений",
      href: "/settings/watermark",
      icon: ImageIcon,
      adminOnly: true,
    },
  ].filter(item => !item.adminOnly || user?.role === "admin");

  return (
    <div className="space-y-6 pb-52">
      <h1 className="text-2xl font-bold">Настройки</h1>

      {/* Временная отладочная информация */}
      {process.env.NODE_ENV === "development" && (
        <div className="p-4 bg-muted rounded-lg text-sm">
          <p>User ID: {user?.id}</p>
          <p>User Role: {user?.role || "не определено"}</p>
          <p>Telegram ID: {user?.telegramId}</p>
          <p>Is Admin: {user?.role === "admin" ? "Да" : "Нет"}</p>
          <p>Filtered items count: {settingsItems.length}</p>
        </div>
      )}

      <div className="">
        {settingsItems.length === 0 ? (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-muted-foreground">
              Нет доступных настроек. Ваша роль: {user?.role || "не определена"}
            </p>
          </div>
        ) : (
          settingsItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="cursor-pointer transition-all hover:shadow-md mb-16">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-muted rounded-lg">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        }))}
      </div>
    </div>
  );
}