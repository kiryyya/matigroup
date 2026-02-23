import { createHmac, timingSafeEqual } from "crypto";
import { TelegramWebApps } from "telegram-webapps-types";
import { env } from "~/env";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { bot } from "~/server/telegram";

type AuthFailReason =
  | "missing_init_data"
  | "missing_bot_token"
  | "missing_hash"
  | "invalid_hash"
  | "invalid_hash_format"
  | "missing_auth_date"
  | "invalid_auth_date_format"
  | "expired_auth_date"
  | "future_auth_date"
  | "replay_detected"
  | "invalid_user_payload";

type ValidationResult = {
  ok: boolean;
  reason?: AuthFailReason;
};

const replayCache = new Map<string, number>();
const authFailCounters = new Map<AuthFailReason, number>();
const REPLAY_CACHE_CLEANUP_INTERVAL_MS = 60_000;
let lastReplayCleanupAt = 0;

function recordAuthFail(reason: AuthFailReason, details?: Record<string, unknown>) {
  const nextCount = (authFailCounters.get(reason) ?? 0) + 1;
  authFailCounters.set(reason, nextCount);

  console.warn(
    "[telegram-auth] auth_fail",
    JSON.stringify({
      reason,
      count: nextCount,
      ...details,
    }),
  );
}

function cleanupReplayCache(nowMs: number): void {
  if (nowMs - lastReplayCleanupAt < REPLAY_CACHE_CLEANUP_INTERVAL_MS) {
    return;
  }

  for (const [key, expiresAtMs] of replayCache.entries()) {
    if (expiresAtMs <= nowMs) {
      replayCache.delete(key);
    }
  }

  lastReplayCleanupAt = nowMs;
}

function isReplayDetected(hash: string, authDate: string): boolean {
  const nowMs = Date.now();
  cleanupReplayCache(nowMs);

  const replayKey = `${hash}:${authDate}`;
  const existingExpiresAtMs = replayCache.get(replayKey);
  if (existingExpiresAtMs && existingExpiresAtMs > nowMs) {
    return true;
  }

  replayCache.set(
    replayKey,
    nowMs + env.TELEGRAM_INITDATA_TTL_SEC * 1000,
  );
  return false;
}

export async function getTelegramUserFromHeaders(headers: Headers) {
  const initData = headers.get("x-telegram-init-data");
  if (!initData) {
    recordAuthFail("missing_init_data");
    return null;
  }

  // Парсим initData
  const data = Object.fromEntries(new URLSearchParams(initData));
  
  if (!env.TELEGRAM_BOT_TOKEN) {
    recordAuthFail("missing_bot_token");
    return null;
  }
  
  const hashValidation = validateHash(data, env.TELEGRAM_BOT_TOKEN);
  if (!hashValidation.ok) {
    recordAuthFail(hashValidation.reason ?? "invalid_hash");
    return null;
  }

  const authDateValidation = validateAuthDate(data.auth_date);
  if (!authDateValidation.ok) {
    recordAuthFail(authDateValidation.reason ?? "invalid_auth_date_format");
    return null;
  }

  if (!data.hash || !data.auth_date) {
    recordAuthFail("invalid_hash");
    return null;
  }

  if (isReplayDetected(data.hash, data.auth_date)) {
    recordAuthFail("replay_detected");
    return null;
  }

  let webAppUser: TelegramWebApps.WebAppUser | null = null;
  try {
    webAppUser = JSON.parse(
      data.user ?? "null",
    ) as TelegramWebApps.WebAppUser;
  } catch {
    recordAuthFail("invalid_user_payload");
    return null;
  }

  if (!webAppUser?.id) {
    recordAuthFail("invalid_user_payload");
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

function validateHash(data: Record<string, string>, botToken: string): ValidationResult {
  if (!data.hash) {
    return { ok: false, reason: "missing_hash" };
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
    const isMatch = timingSafeEqual(
      Buffer.from(calculatedHash, "hex"),
      Buffer.from(providedHash, "hex"),
    );
    return isMatch ? { ok: true } : { ok: false, reason: "invalid_hash" };
  } catch {
    return { ok: false, reason: "invalid_hash_format" };
  }
}

function validateAuthDate(authDate?: string): ValidationResult {
  if (!authDate) {
    return { ok: false, reason: "missing_auth_date" };
  }

  const authDateSeconds = Number(authDate);
  if (!Number.isFinite(authDateSeconds)) {
    return { ok: false, reason: "invalid_auth_date_format" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = nowSeconds - authDateSeconds;

  // Reject stale initData and values that are too far in the future.
  if (ageSeconds > env.TELEGRAM_INITDATA_TTL_SEC) {
    return { ok: false, reason: "expired_auth_date" };
  }

  if (ageSeconds < -env.TELEGRAM_INITDATA_SKEW_SEC) {
    return { ok: false, reason: "future_auth_date" };
  }

  return { ok: true };
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
