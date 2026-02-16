"use client";

import * as React from "react";
import { useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import DefaultLoader from "~/components/layouts/default-loader";
import { api } from "~/trpc/react";
import Loader from "~/components/ui/loader";

export default function HomeClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  const { data: categories, isLoading: isLoadingCategories } = api.categories.getAll.useQuery();
  
  useLayoutEffect(() => {
    // Проверяем, был ли уже обработан deep link в этой сессии
    const processedKey = 'deep_link_processed';
    const processedParam = sessionStorage.getItem(processedKey);
    
    // Проверяем параметры из разных источников
    const checkParams = () => {
      // 1. Проверяем URL параметры (только если их еще не обрабатывали)
      const urlParam = searchParams.get('start') || searchParams.get('startapp');
      
      // 2. Проверяем Telegram WebApp initData (доступно только на клиенте)
      let initDataParam: string | null = null;
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          const initData = window.Telegram.WebApp.initData;
          const urlParams = new URLSearchParams(initData);
          initDataParam = urlParams.get('start_param') ?? urlParams.get('startapp') ?? urlParams.get('start');
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
      
      // 3. Проверяем hash параметры
      let hashParam: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          hashParam = hashParams.get('startapp') ?? hashParams.get('start');
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      
      // Используем первый найденный параметр
      const startParam = urlParam || initDataParam || hashParam;
      
      // Если параметр уже был обработан в этой сессии, пропускаем
      if (processedParam === startParam) {
        setIsChecking(false);
        return;
      }
      
      if (!startParam) {
        setIsChecking(false);
        return;
      }
      
      // Парсим параметр
      let type = '';
      let id: string | undefined;
      
      if (startParam.includes('/')) {
        const parts = startParam.split('/');
        type = parts[0] ?? '';
        id = parts[1];
      } else if (startParam.includes('_')) {
        const parts = startParam.split('_');
        type = parts[0] ?? '';
        id = parts[1];
      } else {
        type = startParam;
      }

      // Редиректим на нужную страницу СРАЗУ, только если мы еще не на нужной странице
      if (type === 'project' && id) {
        // Если уже на странице этого проекта, не редиректим
        if (pathname === `/project/${id}`) {
          setIsChecking(false);
          return;
        }
        // Сохраняем, что этот параметр уже обработан
        sessionStorage.setItem(processedKey, startParam);
        router.replace(`/project/${id}`);
        return;
      }
      
      if (type === 'category' && id) {
        // Если уже на странице этой категории, не редиректим
        if (pathname === `/category/${id}`) {
          setIsChecking(false);
          return;
        }
        // Сохраняем, что этот параметр уже обработан
        sessionStorage.setItem(processedKey, startParam);
        router.replace(`/category/${id}`);
        return;
      }
      
      if (type === 'settings' || type === 'profile') {
        // Если уже на странице настроек, не редиректим
        if (pathname === '/settings') {
          setIsChecking(false);
          return;
        }
        // Сохраняем, что этот параметр уже обработан
        sessionStorage.setItem(processedKey, startParam);
        router.replace('/settings');
        return;
      }

      if (type === 'home' || type === 'main') {
        // Если уже на главной, не редиректим
        if (pathname === '/') {
          setIsChecking(false);
          return;
        }
        // Сохраняем, что этот параметр уже обработан
        sessionStorage.setItem(processedKey, startParam);
        router.replace('/');
        return;
      }
      
      // Если тип неизвестен, не редиректим
      setIsChecking(false);
    };
    
    // Небольшая задержка для инициализации Telegram WebApp
    const timer = setTimeout(() => {
      checkParams();
    }, 0);
    
    return () => clearTimeout(timer);
  }, [searchParams, router, pathname]);

  // Пока проверяем параметры, показываем лоадер вместо контента
  if (isChecking) {
    return <DefaultLoader />;
  }

  // Показываем лоадер, пока загружаются категории
  if (isLoadingCategories) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto pb-52">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {categories && categories.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {categories.map((category) => (
                <Link key={category.id} href={`/category/${category.slug}`}>
                  <Card className="cursor-pointer transition-all hover:shadow-lg aspect-square flex flex-col relative overflow-hidden">
                    {/* Фоновое изображение или цвет */}
                    <div className="absolute inset-0 z-0">
                      {category.backgroundImage ? (
                        <>
                          <Image
                            src={category.backgroundImage}
                            alt={category.name}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              // Если изображение не загрузилось, показываем цветной фон
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40" />
                        </>
                      ) : category.color ? (
                        <div
                          className="absolute inset-0"
                          style={{ backgroundColor: category.color }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                      )}
                      {!category.backgroundImage && (
                        <div className="absolute inset-0 bg-black/40" />
                      )}
                    </div>
                    
                    <CardHeader className="flex-1 flex flex-col justify-end items-start p-4 relative z-10">
                      <CardTitle className="flex items-center gap-2 text-lg text-white">
                        {category.icon && <span>{category.icon}</span>}
                        {category.name}
                      </CardTitle>
                      {category.description && (
                        <CardDescription className="text-sm mt-1 text-white/90">
                          {category.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Категории не найдены</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
