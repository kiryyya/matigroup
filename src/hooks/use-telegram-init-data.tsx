"use client";

import posthog from "posthog-js";
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

  useEffect(() => {
    if (data.user?.id) {
      posthog.identify(data.user?.id.toString(), {
        telegram_id: data.user?.id,
        telegram_username: data.user?.usernames,
        telegram_first_name: data.user?.first_name,
        telegram_last_name: data.user?.last_name,
        language_code: data.user?.language_code,
      });
    }
  }, [data]);

  return { ...data };
}

export default useTelegramInitData;
