"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useModal } from "~/contexts/modal-context";

/**
 * Хук для управления системной кнопкой "Назад" в Telegram Web App
 */
export default function useTelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { isModalOpen } = useModal();

  useEffect(() => {
    // Проверяем, что мы в Telegram Web App
    if (typeof window === "undefined" || !window.Telegram?.WebApp) {
      return;
    }

    const tg = window.Telegram.WebApp;
    const BackButton = tg.BackButton as { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick: (callback: () => void) => void } | undefined;

    if (!BackButton) {
      return;
    }

    // Определяем, нужно ли показывать кнопку "Назад"
    // Показываем если не на главной странице и не открыто модальное окно
    const shouldShow = pathname !== "/" && !isModalOpen;

    if (shouldShow) {
      // Показываем системную кнопку "Назад"
      BackButton.show();

      // Обработчик нажатия
      const handleBack = () => {
        router.back();
      };

      BackButton.onClick(handleBack);

      // Очистка при размонтировании или изменении условий
      return () => {
        BackButton.offClick(handleBack);
        BackButton.hide();
      };
    } else {
      // Скрываем кнопку на главной странице
      BackButton.hide();
    }
  }, [pathname, router, isModalOpen]);
}
