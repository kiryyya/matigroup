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

/**
 * Проверяет CSRF защиту для запроса
 * @param request - Next.js request объект
 * @returns true если запрос безопасен, иначе выбрасывает ошибку
 */
export function validateCSRF(request: NextRequest): boolean {
  const method = request.method;
  
  // GET и HEAD запросы не требуют строгой CSRF защиты
  // Но если Origin/Referer присутствуют, проверяем их для дополнительной безопасности
  if (method === "GET" || method === "HEAD") {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    
    // Если есть Origin или Referer, проверяем их (но не блокируем, если их нет)
    if (origin || referer) {
      if (origin) {
        try {
          const originUrl = new URL(origin);
          const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
            try {
              const allowedUrl = new URL(allowed);
              return originUrl.origin === allowedUrl.origin;
            } catch {
              return false;
            }
          });
          
          if (!isAllowed) {
            console.warn("CSRF: Invalid Origin header for GET request:", origin);
            // Для GET не блокируем, только логируем
          }
        } catch {
          // Игнорируем ошибки парсинга для GET
        }
      }
    }
    
    return true;
  }

  // Для POST, PUT, DELETE, PATCH проверяем Origin и Referer
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  
  // Если есть Origin, проверяем его
  if (origin) {
    const originUrl = new URL(origin);
    const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return originUrl.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
    
    if (!isAllowed) {
      throw new Error("CSRF: Invalid Origin header");
    }
  }
  
  // Если есть Referer, проверяем его
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          return refererUrl.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });
      
      if (!isAllowed) {
        throw new Error("CSRF: Invalid Referer header");
      }
    } catch {
      throw new Error("CSRF: Invalid Referer header format");
    }
  }

  // Для Telegram Web App также проверяем наличие initData
  // Это дополнительная защита, так как initData подписывается ботом
  const initData = request.headers.get("x-telegram-init-data");
  if (!initData && (method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH")) {
    // Для мутаций требуем initData (кроме публичных эндпоинтов)
    // Но не блокируем, так как может быть публичный эндпоинт
    // Просто логируем предупреждение
    console.warn("CSRF: POST/PUT/DELETE request without Telegram initData");
  }

  return true;
}

/**
 * Проверяет CSRF для tRPC запросов
 * @param headers - Headers объект
 * @throws TRPCError если запрос небезопасен
 */
export function validateCSRFForTRPC(headers: Headers): void {
  const method = headers.get("x-http-method-override") || "POST";
  
  // GET запросы не требуют CSRF защиты
  if (method === "GET" || method === "HEAD") {
    return;
  }

  // Если есть Telegram initData, это достаточная защита
  // initData подписывается ботом и не может быть подделан
  const initData = headers.get("x-telegram-init-data");
  if (initData) {
    return; // Пропускаем проверку Origin/Referer для Telegram WebApp
  }

  const origin = headers.get("origin");
  const referer = headers.get("referer");
  
  // Проверяем Origin
  if (origin) {
    const originUrl = new URL(origin);
    const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return originUrl.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
    
    if (!isAllowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "CSRF: Invalid Origin header",
      });
    }
  }
  
  // Проверяем Referer
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          return refererUrl.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });
      
      if (!isAllowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "CSRF: Invalid Referer header",
        });
      }
    } catch {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "CSRF: Invalid Referer header format",
      });
    }
  }
}
