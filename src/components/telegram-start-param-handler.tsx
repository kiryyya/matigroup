"use client";

import { useEffect } from "react";
import useTelegramStartParam from "~/hooks/use-telegram-start-param";

interface TelegramStartParamHandlerProps {
  children: React.ReactNode;
}

export default function TelegramStartParamHandler({ children }: TelegramStartParamHandlerProps) {
  const { startParam, hasProcessed } = useTelegramStartParam();

  useEffect(() => {
    if (startParam && !hasProcessed) {
      console.log('Telegram start param detected:', startParam);
    }
  }, [startParam, hasProcessed]);

  // Дополнительная проверка для отладки
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log('Telegram WebApp available:', !!window.Telegram?.WebApp);
      console.log('Telegram initData:', window.Telegram?.WebApp?.initData);
    }
  }, []);

  return <>{children}</>;
}
