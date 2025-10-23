"use client";

import useTelegramInitData from "~/hooks/use-telegram-init-data";

import * as React from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export default function Home() {
  // const { data } = api.tg.getUser.useQuery();
  // const { user } = useTelegramInitData();

  return (
    <>


      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/category/real-estate">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🏠 Недвижимость
              </CardTitle>
              <CardDescription>
                Проекты недвижимости и архитектурные решения
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/category/interiors">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎨 Интерьеры
              </CardTitle>
              <CardDescription>
                Дизайн интерьеров и декоративные решения
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/category/facades">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🏢 Фасады
              </CardTitle>
              <CardDescription>
                Фасадные решения и внешний дизайн зданий
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/category/furniture">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🪑 Мебель
              </CardTitle>
              <CardDescription>
                Мебельные решения и предметы интерьера
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </>
  );
}

// ProductList removed
