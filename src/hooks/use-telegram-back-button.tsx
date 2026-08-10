"use client";

import { useLayoutEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useModal } from "~/contexts/modal-context";

/**
 * Счётчик клиентских переходов внутри Mini App.
 * history.length / referrer / history.state.idx в Telegram WebView ненадёжны.
 * - cold open / deep link → depth = 0 → «Назад» ведёт на главную
 * - после in-app push → depth > 0 → обычный router.back()
 *
 * Deep link ходит через router.replace с главной — это НЕ должно увеличивать depth,
 * иначе Back вызовет router.back() по пустой истории и «залипнет».
 */
let inAppHistoryDepth = 0;
let skipNextDepthUpdate = false;
let ignoreNextPathChange = false;

/** Вызывать перед router.replace deep link'а, чтобы не считать его за in-app историю */
export function ignoreNextBackDepthChange() {
  ignoreNextPathChange = true;
}

/**
 * Хук для управления системной кнопкой "Назад" в Telegram Web App
 * Использует useLayoutEffect для синхронного обновления без задержек
 *
 * Логика:
 * - На главной странице (pathname === "/"): BackButton скрыта → показывается кнопка "Закрыть" (крестик)
 * - На других страницах: BackButton показана → кнопка "Закрыть" автоматически скрывается Telegram
 */
export default function useTelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { isModalOpen, isFileModalOpen, setIsFileModalOpen } = useModal();

  // Используем ref для хранения обработчика, чтобы не пересоздавать его
  const handlerRef = useRef<(() => void) | null>(null);
  // Используем ref для отслеживания предыдущего состояния, чтобы избежать лишних вызовов
  const prevShouldShowRef = useRef<boolean | null>(null);
  const prevPathnameRef = useRef(pathname);

  // Трекаем in-app навигацию сами — только так надёжно отличить deep link от истории
  useLayoutEffect(() => {
    if (prevPathnameRef.current === pathname) {
      return;
    }

    if (ignoreNextPathChange) {
      ignoreNextPathChange = false;
      // replace deep link / принудительный уход на главную — depth не трогаем
    } else if (skipNextDepthUpdate) {
      skipNextDepthUpdate = false;
      inAppHistoryDepth = Math.max(0, inAppHistoryDepth - 1);
    } else {
      inAppHistoryDepth += 1;
    }

    prevPathnameRef.current = pathname;
  }, [pathname]);

  // Мемоизируем функцию обновления BackButton
  const updateBackButton = useCallback(
    (force = false) => {
      // Проверяем, что мы в Telegram Web App
      if (typeof window === "undefined" || !window.Telegram?.WebApp) {
        return;
      }

      const tg = window.Telegram.WebApp;
      const BackButton = (tg as any).BackButton as {
        show: () => void;
        hide: () => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
      } | undefined;

      if (!BackButton) {
        return;
      }

      // Используем синхронную проверку через window.location для более раннего определения
      // Это гарантирует, что мы получаем актуальный путь до того, как React обновит pathname
      const currentPath = typeof window !== "undefined" ? window.location.pathname : pathname;

      // Удаляем предыдущий обработчик, если он был
      if (handlerRef.current) {
        BackButton.offClick(handlerRef.current);
        handlerRef.current = null;
      }

      // Если открыто модальное окно файла, BackButton должна закрывать его
      if (isFileModalOpen) {
        // Показываем BackButton для закрытия модального окна
        BackButton.show();

        const handleBack = () => {
          console.log("BackButton clicked: closing file modal");
          setIsFileModalOpen(false);
        };

        handlerRef.current = handleBack;
        BackButton.onClick(handleBack);
        // Сбрасываем prevShouldShowRef, чтобы при следующем обновлении логика работала правильно
        prevShouldShowRef.current = null;
        return;
      }

      // Обычная логика для навигации
      const shouldShow = currentPath !== "/" && !isModalOpen;

      // Если состояние не изменилось и не принудительное обновление, не делаем ничего
      if (!force && prevShouldShowRef.current === shouldShow) {
        return;
      }

      // Обновляем предыдущее состояние
      prevShouldShowRef.current = shouldShow;

      if (shouldShow) {
        // Показываем системную кнопку "Назад" синхронно
        // Telegram автоматически скроет кнопку "Закрыть" когда BackButton показана
        BackButton.show();

        // Создаем новый обработчик нажатия
        const handleBack = () => {
          if (inAppHistoryDepth > 0) {
            skipNextDepthUpdate = true;
            router.back();
            return;
          }

          // Deep-link / cold open: истории внутри приложения нет → на главную
          ignoreNextPathChange = true;
          router.replace("/");
        };

        handlerRef.current = handleBack;
        BackButton.onClick(handleBack);
      } else {
        // Скрываем кнопку "Назад" на главной странице синхронно
        // Telegram автоматически покажет кнопку "Закрыть" когда BackButton скрыта
        BackButton.hide();
      }
    },
    [pathname, isModalOpen, isFileModalOpen, setIsFileModalOpen, router],
  );

  // Синхронное обновление через useLayoutEffect (выполняется до отрисовки)
  // Это гарантирует, что кнопка обновится до того, как пользователь увидит интерфейс
  useLayoutEffect(() => {
    updateBackButton(true);
  }, [updateBackButton]);
}
