"use client";

// PostHog removed
import { useEffect, useState } from "react";
import { type TelegramWebApps } from "telegram-webapps-types";

/**
 * Hook to get the initial data from the Telegram Web Apps API already parsed.
 * @example
 * const { hash } = useTelegramInitData();
 * console.log({ hash });
 */
function useTelegramInitData() {
  const [data, setData] = useState<TelegramWebApps.WebAppInitData>({});
  const _initData =
    typeof window !== "undefined"
      ? window?.Telegram?.WebApp?.initData ?? ""
      : "";

  useEffect(() => {
    const firstLayerInitData = Object.fromEntries(
      new URLSearchParams(_initData),
    );

    const initData: Record<string, string> = {};

    for (const key in firstLayerInitData) {
      try {
        // @ts-expect-error okthis
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        initData[key] = JSON.parse(firstLayerInitData[key]);
      } catch {
        // @ts-expect-error okthis
        initData[key] = firstLayerInitData[key];
      }
    }

    setData({ ...initData });
  }, []);

  // PostHog removed

  return { ...data };
}

export default useTelegramInitData;
