"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * Компонент для инициализации Telegram Web App с нужными настройками
 * Предотвращает закрытие приложения при скролле вниз
 */
export default function TelegramWebAppInit() {
  useLayoutEffect(() => {
    window.Telegram.WebApp.ready();
  }, []);

  useEffect(() => {
    // Проверяем, что мы в Telegram Web App
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Расширяем viewport на весь экран
      tg.expand();
      
      // Запрашиваем полноэкранный режим (с проверкой типов)
      if (typeof (tg as any).requestFullscreen === "function") {
        (tg as any).requestFullscreen();
      }
      
      // Отключаем вертикальные свайпы (с проверкой типов)
      if (typeof (tg as any).disableVerticalSwipes === "function") {
        (tg as any).disableVerticalSwipes();
      }
      
      // Настраиваем поведение закрытия - только через кнопку
      if (typeof (tg as any).setClosingBehavior === "function") {
        (tg as any).setClosingBehavior("button");
      }
      
      // Включаем подтверждение закрытия
      if (typeof (tg as any).enableClosingConfirmation === "function") {
        (tg as any).enableClosingConfirmation();
      }
      
      console.log("Telegram Web App initialized with fullscreen and disabled vertical swipes");
    }
  }, []);

  return null; // Этот компонент не рендерит ничего
}
