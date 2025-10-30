"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function useTelegramStartParam() {
  const router = useRouter();
  const [hasProcessed, setHasProcessed] = useState(false);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    // Получаем start_param/startapp из Telegram WebApp initData
    const getStartParam = () => {
      if (typeof window === "undefined") return null;
      
      try {
        // Получаем initData из Telegram WebApp
        const initData = window?.Telegram?.WebApp?.initData || "";
        console.log('Telegram initData:', initData);
        
        if (initData) {
          const urlParams = new URLSearchParams(initData);
          const startParam = urlParams.get('start_param') ?? urlParams.get('startapp') ?? urlParams.get('start');
          console.log('Найден start_param:', startParam);
          return startParam;
        }
        
        // Альтернативный способ - проверяем URL параметры
        const urlParams = new URLSearchParams(window.location.search);
        const urlStartParam = urlParams.get('startapp') ?? urlParams.get('start');
        if (urlStartParam) {
          console.log('Найден start_param в URL:', urlStartParam);
          return urlStartParam;
        }
        
        // Также проверяем hash параметры (для Telegram WebApp)
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

    if (!startParamValue || hasProcessed) return;

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

    // Небольшая задержка для корректной инициализации роутера
    const timer = setTimeout(() => {
      switch (type) {
        case 'project':
          if (id) {
            console.log('Переход к проекту:', id);
            router.push(`/project/${id}`);
          } else {
            router.push('/');
          }
          break;

        case 'category':
          if (id) {
            console.log('Переход к категории:', id);
            router.push(`/category/${id}`);
          } else {
            router.push('/');
          }
          break;

        case 'profile':
          router.push('/settings');
          break;

        case 'settings':
          console.log('Переход к настройкам');
          router.push('/settings');
          break;

        case 'home':
        case 'main':
          console.log('Переход на главную');
          router.push('/');
          break;

        default:
          console.log('Неизвестный параметр:', type);
          break;
      }

      setHasProcessed(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [router, hasProcessed]);

  return {
    startParam,
    hasProcessed,
  };
}
