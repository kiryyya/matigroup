import { createHmac, timingSafeEqual } from "crypto";
import { TelegramWebApps } from "telegram-webapps-types";
import { env } from "~/env";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { bot } from "~/server/telegram";

const TELEGRAM_INIT_DATA_TTL_SECONDS = 15 * 60;
const TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS = 30;

export async function getTelegramUserFromHeaders(headers: Headers) {
  const initData = headers.get("x-telegram-init-data");
  if (!initData) {
    console.error("[telegram-auth] getTelegramUserFromHeaders: initData is missing");
    return null;
  }

  // Парсим initData
  const data = Object.fromEntries(new URLSearchParams(initData));
  
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error("[telegram-auth] getTelegramUserFromHeaders: TELEGRAM_BOT_TOKEN is missing");
    return null;
  }
  
  const isValid = isHashValid(data, env.TELEGRAM_BOT_TOKEN);
  if (!isValid) {
    console.error("[telegram-auth] getTelegramUserFromHeaders: hash validation failed");
    return null;
  }

  const authDateIsValid = isAuthDateValid(data.auth_date);
  if (!authDateIsValid) {
    console.error("[telegram-auth] getTelegramUserFromHeaders: auth_date is expired or invalid");
    return null;
  }

  const webAppUser = JSON.parse(
    data.user ?? "null",
  ) as TelegramWebApps.WebAppUser;

  if (!webAppUser?.id) {
    console.error("[telegram-auth] getTelegramUserFromHeaders: user payload is invalid");
    return null;
  }

  return checkOrCreateUser(webAppUser);
}

export async function requireTelegramUser(headers: Headers) {
  const user = await getTelegramUserFromHeaders(headers);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireTelegramAdmin(headers: Headers) {
  const user = await requireTelegramUser(headers);
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}

function isHashValid(data: Record<string, string>, botToken: string) {
  if (!data.hash) {
    console.error("[telegram-auth] isHashValid: missing hash in initData");
    return false;
  }

  // Для Telegram WebApp hash в checkString исключается только поле hash.
  const checkString = Object.keys(data)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHashHex = createHmac("sha256", secret)
    .update(checkString)
    .digest("hex");

  const providedHash = data.hash.trim().toLowerCase();
  const calculatedHash = calculatedHashHex.toLowerCase();

  try {
    return timingSafeEqual(
      Buffer.from(calculatedHash, "hex"),
      Buffer.from(providedHash, "hex"),
    );
  } catch {
    console.error("[telegram-auth] isHashValid: invalid hash format");
    return false;
  }
}

function isAuthDateValid(authDate?: string): boolean {
  if (!authDate) {
    console.error("[telegram-auth] isAuthDateValid: missing auth_date");
    return false;
  }

  const authDateSeconds = Number(authDate);
  if (!Number.isFinite(authDateSeconds)) {
    console.error("[telegram-auth] isAuthDateValid: invalid auth_date format");
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = nowSeconds - authDateSeconds;

  // Reject stale initData and values that are too far in the future.
  if (ageSeconds > TELEGRAM_INIT_DATA_TTL_SECONDS) {
    console.error("[telegram-auth] isAuthDateValid: auth_date TTL exceeded", {
      ageSeconds,
      ttlSeconds: TELEGRAM_INIT_DATA_TTL_SECONDS,
    });
    return false;
  }

  if (ageSeconds < -TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS) {
    console.error("[telegram-auth] isAuthDateValid: auth_date is too far in the future", {
      ageSeconds,
      allowedFutureSkewSeconds: TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS,
    });
    return false;
  }

  return true;
}

/**
 * Получает username пользователя через Bot API, если его нет в initData
 */
async function getUsernameFromBotAPI(telegramId: string): Promise<string | null> {
  try {
    const chat = await bot.telegram.getChat(telegramId);
    // getChat возвращает объект с полем username для пользователей
    if ('username' in chat && chat.username) {
      return chat.username;
    }
    return null;
  } catch (error) {
    console.error(`[telegram-auth] Error getting username from Bot API for ${telegramId}:`, error);
    return null;
  }
}

async function checkOrCreateUser(webAppUser: TelegramWebApps.WebAppUser) {
  if (!webAppUser.id) {
    return null;
  }

  const webAppUsername = (webAppUser as any).username as string | undefined;

  const telegramId = webAppUser.id.toString();

  let user = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });

  // Нормализуем username из initData: если пустая строка, то null
  let username = webAppUsername && webAppUsername.trim() !== "" 
    ? webAppUsername.trim() 
    : null;

  // Если username нет в initData, получаем его через Bot API
  if (!username) {
    username = await getUsernameFromBotAPI(telegramId);
  }

  if (!user) {
    user = await db
      .insert(users)
      .values({
        telegramId,
        name: `${webAppUser.first_name} ${webAppUser.last_name}`.trim(),
        image: webAppUser.photo_url,
        username,
      })
      .returning()
      .then((r) => r[0]);
  } else {
    // Обновляем username если он изменился или был добавлен
    // Обновляем только если username изменился
    if (user.username !== username) {
      await db
        .update(users)
        .set({ username })
        .where(eq(users.telegramId, telegramId));
      // Обновляем локальный объект user
      user = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId),
      }) ?? user;
    }
  }

  return user;
}
