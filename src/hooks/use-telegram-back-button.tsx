"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useModal } from "~/contexts/modal-context";

/**
 * Хук для управления системной кнопкой "Назад" в Telegram Web App
 * Использует useLayoutEffect для синхронного обновления без задержек
 */
export default function useTelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { isModalOpen } = useModal();
  
  // Используем ref для хранения обработчика, чтобы не пересоздавать его
  const handlerRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    // Проверяем, что мы в Telegram Web App
    if (typeof window === "undefined" || !window.Telegram?.WebApp) {
      return;
    }

    const tg = window.Telegram.WebApp;
    // Используем any для обхода проблем с типизацией Telegram Web App API
    const BackButton = (tg as any).BackButton as {
      show: () => void;
      hide: () => void;
      onClick: (callback: () => void) => void;
      offClick: (callback: () => void) => void;
    } | undefined;

    if (!BackButton) {
      return;
    }

    // Определяем, нужно ли показывать кнопку "Назад"
    // Показываем если не на главной странице и не открыто модальное окно
    const shouldShow = pathname !== "/" && !isModalOpen;

    // Удаляем предыдущий обработчик, если он был
    if (handlerRef.current) {
      BackButton.offClick(handlerRef.current);
      handlerRef.current = null;
    }

    if (shouldShow) {
      // Показываем системную кнопку "Назад" синхронно
      BackButton.show();

      // Создаем новый обработчик нажатия
      const handleBack = () => {
        router.back();
      };
      
      handlerRef.current = handleBack;
      BackButton.onClick(handleBack);
    } else {
      // Скрываем кнопку на главной странице синхронно
      BackButton.hide();
    }

    // Очистка при размонтировании или изменении условий
    return () => {
      if (handlerRef.current) {
        BackButton.offClick(handlerRef.current);
        handlerRef.current = null;
      }
      BackButton.hide();
    };
  }, [pathname, router, isModalOpen]);
}
