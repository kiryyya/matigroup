"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useModal } from "~/contexts/modal-context";

/**
 * Компонент для управления системной кнопкой "Назад" Telegram Web App
 * - На главной странице: скрывает кнопку "Назад", показывает кнопку "Закрыть"
 * - На других страницах: показывает системную кнопку "Назад"
 */
export default function TelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { isModalOpen } = useModal();

  useEffect(() => {
    // Проверяем, что мы в Telegram Web App
    if (typeof window === "undefined" || !window.Telegram?.WebApp) {
      return;
    }

    const tg = window.Telegram.WebApp;
    const BackButton = tg.BackButton;
    const MainButton = tg.MainButton;

    if (!BackButton || !MainButton) {
      return;
    }

    // Определяем, на главной ли мы странице
    const isHomePage = pathname === "/";
    
    // Не показываем кнопки, если открыто модальное окно
    if (isModalOpen) {
      BackButton.hide();
      MainButton.hide();
      return;
    }

    if (isHomePage) {
      // На главной странице: скрываем "Назад", показываем "Закрыть"
      BackButton.hide();
      
      // Настраиваем главную кнопку как "Закрыть"
      MainButton.setText("Закрыть");
      MainButton.show();
      
      // Обработчик закрытия приложения
      const handleClose = () => {
        try {
          tg.close();
        } catch (error) {
          console.warn("Telegram WebApp close failed:", error);
        }
      };
      
      MainButton.onClick(handleClose);
      
      // Очистка при размонтировании
      return () => {
        // Удаляем обработчик, если метод существует
        if (typeof MainButton.offClick === 'function') {
          MainButton.offClick(handleClose);
        }
        MainButton.hide();
      };
    } else {
      // На других страницах: показываем системную кнопку "Назад", скрываем главную
      MainButton.hide();
      
      BackButton.show();
      
      // Обработчик возврата назад
      const handleBack = () => {
        router.back();
      };
      
      BackButton.onClick(handleBack);
      
      // Очистка при размонтировании
      return () => {
        // Удаляем обработчик, если метод существует
        if (typeof BackButton.offClick === 'function') {
          BackButton.offClick(handleBack);
        }
        BackButton.hide();
      };
    }
  }, [pathname, router, isModalOpen]);

  // Этот компонент не рендерит ничего визуально
  return null;
}
