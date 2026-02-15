"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import Loader from "~/components/ui/loader";
import Link from "next/link";
import { Search, Plus, Image as ImageIcon, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

export default function Settings() {
  const { data: user, isLoading } = api.tg.getUser.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

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

      <div className="space-y-6">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="cursor-pointer transition-all hover:shadow-md">
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
        })}
      </div>
    </div>
  );
}