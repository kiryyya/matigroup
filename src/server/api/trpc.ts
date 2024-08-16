/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { webcrypto } from "crypto";
import superjson from "superjson";
import { TelegramWebApps } from "telegram-webapps-types";
import { ZodError } from "zod";
import { env } from "~/env";

import { db } from "~/server/db";
import { promocodes, users } from "../db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const initData = opts.headers.get("x-telegram-init-data");
  if (!initData) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const data = Object.fromEntries(new URLSearchParams(initData));
  const isValid = await isHashValid(data, env.TELEGRAM_BOT_TOKEN);

  if (!isValid) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const webAppUser = JSON.parse(
    data.user ?? "null",
  ) as TelegramWebApps.WebAppUser;

  const user = await chekOrCreateUser(webAppUser, data.start_param);

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return {
    db,
    ...opts,
    user,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const procedure = t.procedure;

async function isHashValid(data: Record<string, string>, botToken: string) {
  const encoder = new TextEncoder();

  const checkString = Object.keys(data)
    .filter((key) => key !== "hash")
    .map((key) => `${key}=${data[key]}`)
    .sort()
    .join("\n");

  const secretKey = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign"],
  );

  const secret = await webcrypto.subtle.sign(
    "HMAC",
    secretKey,
    encoder.encode(botToken),
  );

  const signatureKey = await webcrypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign"],
  );

  const signature = await webcrypto.subtle.sign(
    "HMAC",
    signatureKey,
    encoder.encode(checkString),
  );

  const hex = Buffer.from(signature).toString("hex");

  return data.hash === hex;
}

const chekOrCreateUser = async (
  webAppUser: TelegramWebApps.WebAppUser,
  promocode?: string,
) => {
  if (!webAppUser.id) return;

  let user = await db.query.users.findFirst({
    where: eq(users.telegramId, webAppUser.id.toString()),
  });

  console.log({
    user,
    promocode,
  });

  if (!user) {
    user = await db
      .insert(users)
      .values({
        telegramId: webAppUser.id.toString(),
        name: `${webAppUser.first_name} ${webAppUser.last_name}`.trim(),
        image: webAppUser.photo_url,
      })
      .returning()
      .then((r) => r[0]);
  }

  if (promocode && user) {
    const code = await db.query.promocodes.findFirst({
      where: eq(promocodes.code, promocode),
    });
    const refUser = await db.query.users.findFirst({
      where: eq(users.telegramId, promocode),
    });

    if (code ?? refUser) {
      if (
        (code && user.activatedCodes?.includes(code.code)) ??
        (code && user.usedCodes?.includes(code.code)) ??
        (refUser?.telegramId && user.usedCodes?.includes(refUser.telegramId))
      ) {
        return user;
      }

      if (code?.type === "referral") {
        await db
          .update(users)
          .set({
            tapCount: sql`${users.tapCount} + ${code.amount}`,
            usedCodes: [...(user.usedCodes ?? []), code.code],
          })
          .where(eq(users.id, user.id));
      } else if (code?.type === "promocode") {
        await db
          .update(users)
          .set({
            activatedCodes: [...(user.activatedCodes ?? []), `${code.code}`],
          })
          .where(eq(users.id, user.id));
      } else if (refUser?.telegramId) {
        await db
          .update(users)
          .set({
            usedCodes: [...(user.usedCodes ?? []), `${refUser?.telegramId}`],
          })
          .where(eq(users.id, user.id));
      }
    }
  }

  return user;
};
