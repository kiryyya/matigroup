import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { validateCSRFForTRPC } from "~/lib/csrf";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic';

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = (req: NextRequest) => {
  const url = new URL(req.url);
  console.error(`[tRPC] Request: ${req.method} ${url.pathname}${url.search}`);
  console.error(`[tRPC] Headers: x-telegram-init-data present: ${!!req.headers.get("x-telegram-init-data")}`);

  const ip = getClientIp(req.headers);
  const rateLimitResult = checkRateLimit(`trpc:${ip}`, {
    windowMs: 60_000,
    maxRequests: 180,
  });
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfterSeconds.toString(),
        },
      },
    );
  }
  
  // CSRF защита для tRPC запросов
  try {
    validateCSRFForTRPC(req.headers, req.method);
  } catch (error) {
    console.error(`[tRPC] CSRF validation failed:`, error);
    // Если CSRF проверка не прошла, возвращаем ошибку
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "CSRF validation failed" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    // Allow POST for queries (httpBatchLink may POST when batching / overrides).
    allowMethodOverride: true,
    onError: ({ path, error }) => {
      console.error(
        `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
        error
      );
    },
  });
};

export { handler as GET, handler as POST };
