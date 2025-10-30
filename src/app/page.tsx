"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid gap-4 md:grid-cols-2 pb-52">
        <Link href="/category/real-estate">
          <Card className="cursor-pointer transition-all hover:shadow-lg aspect-square flex flex-col relative overflow-hidden">
            {/* Фоновое изображение */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/benedict-canyon-whipple-russell-architecture-residential-houses-california-usa_dezeen_2364_hero.jpg"
                alt="Архитектурный фон"
                fill
                className="object-cover"
              />
              {/* Темный оверлей для лучшей читаемости текста */}
              <div className="absolute inset-0 bg-black/40" />
            </div>
            
            <CardHeader className="flex-1 flex flex-col justify-end items-start p-4 relative z-10">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                Недвижимость
              </CardTitle>
              <CardDescription className="text-sm mt-1 text-white/90">
                Проекты недвижимости и архитектурные решения
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/category/interiors">
          <Card className="cursor-pointer transition-all hover:shadow-lg aspect-square flex flex-col relative overflow-hidden">
            {/* Фоновое изображение */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/benedict-canyon-whipple-russell-architecture-residential-houses-california-usa_dezeen_2364_hero.jpg"
                alt="Архитектурный фон"
                fill
                className="object-cover"
              />
              {/* Темный оверлей для лучшей читаемости текста */}
              <div className="absolute inset-0 bg-black/40" />
            </div>
            
            <CardHeader className="flex-1 flex flex-col justify-end items-start p-4 relative z-10">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                Интерьеры
              </CardTitle>
              <CardDescription className="text-sm mt-1 text-white/90">
                Дизайн интерьеров и декоративные решения
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/category/facades">
          <Card className="cursor-pointer transition-all hover:shadow-lg aspect-square flex flex-col relative overflow-hidden">
            {/* Фоновое изображение */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/benedict-canyon-whipple-russell-architecture-residential-houses-california-usa_dezeen_2364_hero.jpg"
                alt="Архитектурный фон"
                fill
                className="object-cover"
              />
              {/* Темный оверлей для лучшей читаемости текста */}
              <div className="absolute inset-0 bg-black/40" />
            </div>
            
            <CardHeader className="flex-1 flex flex-col justify-end items-start p-4 relative z-10">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                Фасады
              </CardTitle>
              <CardDescription className="text-sm mt-1 text-white/90">
                Фасадные решения и внешний дизайн зданий
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/category/furniture">
          <Card className="cursor-pointer transition-all hover:shadow-lg aspect-square flex flex-col relative overflow-hidden">
            {/* Фоновое изображение */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/benedict-canyon-whipple-russell-architecture-residential-houses-california-usa_dezeen_2364_hero.jpg"
                alt="Архитектурный фон"
                fill
                className="object-cover"
              />
              {/* Темный оверлей для лучшей читаемости текста */}
              <div className="absolute inset-0 bg-black/40" />
            </div>
            
            <CardHeader className="flex-1 flex flex-col justify-end items-start p-4 relative z-10">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                Мебель
              </CardTitle>
              <CardDescription className="text-sm mt-1 text-white/90">
                Мебельные решения и предметы интерьера
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
