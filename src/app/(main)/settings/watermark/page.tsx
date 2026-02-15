"use client";

import { api } from "~/trpc/react";
import Loader from "~/components/ui/loader";
import WatermarkSettings from "~/components/watermark-settings";
import Link from "next/link";
import { Button } from "~/components/ui/button";

export default function WatermarkSettingsPage() {
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
        <h1 className="text-2xl font-bold">Настройки водяного знака</h1>
        <p className="text-muted-foreground">
          Настройте параметры водяного знака, который будет автоматически добавляться к загружаемым изображениям
        </p>
      </div>

      <WatermarkSettings />
    </div>
  );
}
