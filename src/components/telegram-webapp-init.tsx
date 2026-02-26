"use client";

import { useEffect, useLayoutEffect } from "react";

const getMethod = (obj: unknown, key: string) => {
  if (!obj || typeof obj !== "object") return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "function" ? value : null;
};

/**
 * Компонент для инициализации Telegram Web App с нужными настройками
 * Предотвращает закрытие приложения при скролле вниз
 */
export default function TelegramWebAppInit() {
  useLayoutEffect(() => {
    window.Telegram?.WebApp?.ready();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Проверяем, что мы в Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      const body = window.document.body;
      const isDesktopTelegram = tg.platform === "tdesktop" || tg.platform === "macos";

      // Верхний отступ нужен только в мобильном Telegram-клиенте.
      if (isDesktopTelegram) {
        body.classList.remove("tg-mobile-top-offset");
      } else {
        body.classList.add("tg-mobile-top-offset");
      }
      
      // На десктопе фиксируем текущий размер и не разрешаем автоматическое "раздувание".
      if (!isDesktopTelegram) {
        try {
          tg.expand();
        } catch (error) {
          console.warn("Telegram WebApp expand failed:", error);
        }
      }
      
      // Полноэкранный режим оставляем только для мобильных клиентов.
      if (!isDesktopTelegram) {
        const requestFullscreen = getMethod(tg, "requestFullscreen") as (() => void) | null;
        if (requestFullscreen) {
          try {
            requestFullscreen();
          } catch (error) {
            console.warn("Telegram WebApp fullscreen not supported:", error);
          }
        }
      }
      
      // Отключаем вертикальные свайпы (с проверкой типов)
      const disableVerticalSwipes = getMethod(tg, "disableVerticalSwipes") as
        | (() => void)
        | null;
      if (disableVerticalSwipes) {
        try {
          disableVerticalSwipes();
        } catch (error) {
          console.warn("Telegram WebApp disableVerticalSwipes failed:", error);
        }
      }
      
      // Настраиваем поведение закрытия - только через кнопку
      const setClosingBehavior = getMethod(tg, "setClosingBehavior") as
        | ((behavior: string) => void)
        | null;
      if (setClosingBehavior) {
        try {
          setClosingBehavior("button");
        } catch (error) {
          console.warn("Telegram WebApp setClosingBehavior failed:", error);
        }
      }
      
      // Включаем подтверждение закрытия
      const enableClosingConfirmation = getMethod(
        tg,
        "enableClosingConfirmation",
      ) as (() => void) | null;
      if (enableClosingConfirmation) {
        try {
          enableClosingConfirmation();
        } catch (error) {
          console.warn("Telegram WebApp enableClosingConfirmation failed:", error);
        }
      }
      
      // Блокируем browser-zoom только для Telegram Desktop.
      if (isDesktopTelegram) {
        const onWheel = (event: WheelEvent) => {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
          }
        };

        const onKeyDown = (event: KeyboardEvent) => {
          const isZoomShortcut =
            (event.ctrlKey || event.metaKey) &&
            (event.key === "+" || event.key === "-" || event.key === "=" || event.key === "0");
          if (isZoomShortcut) {
            event.preventDefault();
          }
        };

        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("keydown", onKeyDown);

        return () => {
          body.classList.remove("tg-mobile-top-offset");
          window.removeEventListener("wheel", onWheel);
          window.removeEventListener("keydown", onKeyDown);
        };
      }

      console.log("Telegram Web App initialized");

      return () => {
        body.classList.remove("tg-mobile-top-offset");
      };
    }
  }, []);

  return null; // Этот компонент не рендерит ничего
}
