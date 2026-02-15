"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function useTelegramStartParam() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasProcessed, setHasProcessed] = useState(false);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    // Получаем start_param/startapp ТОЛЬКО из Telegram WebApp initData
    // URL параметры обрабатываются middleware на сервере (без загрузки главной страницы)
    const getStartParam = () => {
      if (typeof window === "undefined") return null;
      
      try {
        // Получаем initData из Telegram WebApp (это доступно только на клиенте)
        const initData = window?.Telegram?.WebApp?.initData || "";
        
        if (initData) {
          const urlParams = new URLSearchParams(initData);
          const startParam = urlParams.get('start_param') ?? urlParams.get('startapp') ?? urlParams.get('start');
          if (startParam) {
            console.log('Найден start_param в Telegram WebApp initData:', startParam);
            return startParam;
          }
        }
        
        // Проверяем hash параметры (для Telegram WebApp)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashStartParam = hashParams.get('startapp') ?? hashParams.get('start');
        if (hashStartParam) {
          console.log('Найден start_param в hash:', hashStartParam);
          return hashStartParam;
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка получения start_param:', error);
        return null;
      }
    };

    const startParamValue = getStartParam();
    setStartParam(startParamValue);

    // Проверяем, был ли уже обработан этот параметр в sessionStorage
    const processedKey = 'deep_link_processed';
    const processedParam = typeof window !== 'undefined' ? sessionStorage.getItem(processedKey) : null;
    
    if (!startParamValue || hasProcessed || processedParam === startParamValue) {
      return;
    }

    console.log('Обработка start_param:', startParamValue);

    // Поддерживаем два формата payload: "type/id" и "type_id"
    let type = '';
    let id: string | undefined;
    if (startParamValue.includes('/')) {
      const parts = startParamValue.split('/');
      type = parts[0] ?? '';
      id = parts[1];
    } else if (startParamValue.includes('_')) {
      const parts = startParamValue.split('_');
      type = parts[0] ?? '';
      id = parts[1];
    } else {
      type = startParamValue;
    }

    // Используем replace вместо push, чтобы не добавлять в историю
    // Небольшая задержка для корректной инициализации роутера
    const timer = setTimeout(() => {
      // Проверяем, не находимся ли мы уже на нужной странице
      let shouldRedirect = true;
      
      switch (type) {
        case 'project':
          if (id && pathname === `/project/${id}`) {
            shouldRedirect = false;
          }
          break;

        case 'category':
          if (id && pathname === `/category/${id}`) {
            shouldRedirect = false;
          }
          break;

        case 'profile':
        case 'settings':
          if (pathname === '/settings') {
            shouldRedirect = false;
          }
          break;

        case 'home':
        case 'main':
          if (pathname === '/') {
            shouldRedirect = false;
          }
          break;
      }
      
      // Если уже на нужной странице, не редиректим
      if (!shouldRedirect) {
        setHasProcessed(true);
        return;
      }
      
      // Сохраняем, что этот параметр уже обработан
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(processedKey, startParamValue);
      }
      
      switch (type) {
        case 'project':
          if (id) {
            console.log('Переход к проекту:', id);
            router.replace(`/project/${id}`);
          }
          break;

        case 'category':
          if (id) {
            console.log('Переход к категории:', id);
            router.replace(`/category/${id}`);
          }
          break;

        case 'profile':
        case 'settings':
          console.log('Переход к настройкам');
          router.replace('/settings');
          break;

        case 'home':
        case 'main':
          console.log('Переход на главную');
          router.replace('/');
          break;

        default:
          console.log('Неизвестный параметр:', type);
          break;
      }

      setHasProcessed(true);
    }, 300); // Уменьшена задержка, так как это только для initData

    return () => clearTimeout(timer);
  }, [router, hasProcessed, pathname]);

  return {
    startParam,
    hasProcessed,
  };
}
