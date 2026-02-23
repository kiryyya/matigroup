import { NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";

/**
 * Разрешенные источники для запросов
 * Telegram Web App может работать с разных доменов
 */
const ALLOWED_ORIGINS = [
  "https://web.telegram.org",
  "https://webk.telegram.org",
  "https://webz.telegram.org",
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[];

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isOriginAllowed(value: string | null): boolean {
  if (!value) {
    return false;
  }

  try {
    const valueUrl = new URL(value);
    return ALLOWED_ORIGINS.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return valueUrl.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function hasTelegramInitData(headers: Headers): boolean {
  const initData = headers.get("x-telegram-init-data");
  return Boolean(initData && initData.trim().length > 0);
}

/**
 * Проверяет CSRF защиту для запроса
 * @param request - Next.js request объект
 * @returns true если запрос безопасен, иначе выбрасывает ошибку
 */
export function validateCSRF(request: NextRequest): boolean {
  const method = request.method;

  // Безопасные методы не требуют строгой CSRF защиты.
  if (isSafeMethod(method)) {
    return true;
  }

  // Для Telegram WebApp initData является отдельным валидируемым фактором.
  if (hasTelegramInitData(request.headers)) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Для mutating-запросов требуем хотя бы один браузерный источник.
  if (!origin && !referer) {
    throw new Error("CSRF: Missing Origin/Referer and Telegram initData");
  }

  if (origin && !isOriginAllowed(origin)) {
    throw new Error("CSRF: Invalid Origin header");
  }

  if (referer && !isOriginAllowed(referer)) {
    throw new Error("CSRF: Invalid Referer header");
  }

  return true;
}

/**
 * Проверяет CSRF для tRPC запросов
 * @param headers - Headers объект
 * @throws TRPCError если запрос небезопасен
 */
export function validateCSRFForTRPC(headers: Headers): void {
  const method = headers.get("x-http-method-override") ?? "POST";

  if (isSafeMethod(method)) {
    return;
  }

  if (hasTelegramInitData(headers)) {
    return;
  }

  const origin = headers.get("origin");
  const referer = headers.get("referer");

  if (!origin && !referer) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CSRF: Missing Origin/Referer and Telegram initData",
    });
  }

  if (origin && !isOriginAllowed(origin)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CSRF: Invalid Origin header",
    });
  }

  if (referer && !isOriginAllowed(referer)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CSRF: Invalid Referer header",
    });
  }
}
