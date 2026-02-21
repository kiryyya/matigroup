import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { validateCSRFForTRPC } from "~/lib/csrf";

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
  // CSRF защита для tRPC запросов
  try {
    validateCSRFForTRPC(req.headers);
  } catch (error) {
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
    onError: ({ path, error }) => {
      console.error(
        `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
        error
      );
    },
  });
};

export { handler as GET, handler as POST };
