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
    // Проверяем, что мы в Telegram Web App
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Расширяем viewport на весь экран
      try {
      tg.expand();
      } catch (error) {
        console.warn("Telegram WebApp expand failed:", error);
      }
      
      // Запрашиваем полноэкранный режим (с проверкой типов)
      const requestFullscreen = getMethod(tg, "requestFullscreen") as (() => void) | null;
      if (requestFullscreen) {
        try {
          requestFullscreen();
        } catch (error) {
          console.warn("Telegram WebApp fullscreen not supported:", error);
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
      
      console.log("Telegram Web App initialized with fullscreen and disabled vertical swipes");
    }
  }, []);

  return null; // Этот компонент не рендерит ничего
}
