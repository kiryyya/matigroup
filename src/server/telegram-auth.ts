import { webcrypto } from "crypto";
import { writeFileSync, appendFileSync } from "fs";
import { TelegramWebApps } from "telegram-webapps-types";
import { env } from "~/env";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { bot } from "~/server/telegram";

export async function getTelegramUserFromHeaders(headers: Headers) {
  const initData = headers.get("x-telegram-init-data");
  console.error('[telegram-auth] getTelegramUserFromHeaders: initData present:', !!initData);
  if (!initData) {
    console.error('[telegram-auth] getTelegramUserFromHeaders: initData is missing');
    return null;
  }

  const data = Object.fromEntries(new URLSearchParams(initData));
  console.error('[telegram-auth] getTelegramUserFromHeaders: parsed data keys:', Object.keys(data).join(', '));
  const isValid = await isHashValid(data, env.TELEGRAM_BOT_TOKEN);
  console.error('[telegram-auth] getTelegramUserFromHeaders: hash valid:', isValid);
  if (!isValid) {
    console.error('[telegram-auth] getTelegramUserFromHeaders: hash validation failed');
    return null;
  }

  const webAppUser = JSON.parse(
    data.user ?? "null",
  ) as TelegramWebApps.WebAppUser;

  if (!webAppUser?.id) {
    return null;
  }

  // Логируем raw данные для отладки (используем console.error и файл)
  const logData = {
    timestamp: new Date().toISOString(),
    rawInitDataUser: data.user,
    parsedWebAppUser: webAppUser,
  };
  console.error('[telegram-auth] Raw initData user:', data.user);
  console.error('[telegram-auth] Parsed webAppUser:', JSON.stringify(webAppUser, null, 2));
  try {
    appendFileSync('/app/telegram-auth.log', JSON.stringify(logData, null, 2) + '\n\n');
  } catch (e) {
    // Логируем ошибку записи в файл
    console.error('[telegram-auth] Error writing to log file:', e);
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

  // Логируем весь объект webAppUser для отладки (используем console.error чтобы точно попало в логи)
  console.error('[telegram-auth] Full webAppUser object:', JSON.stringify(webAppUser, null, 2));
  const webAppUsername = (webAppUser as any).username as string | undefined;
  console.error('[telegram-auth] webAppUser.username:', webAppUsername, 'type:', typeof webAppUsername);

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
    console.error(`[telegram-auth] Username not in initData, fetching from Bot API for telegramId=${telegramId}`);
    username = await getUsernameFromBotAPI(telegramId);
    if (username) {
      console.error(`[telegram-auth] Got username from Bot API: ${username}`);
    }
  }

  if (!user) {
    console.error(`[telegram-auth] Creating user: telegramId=${telegramId}, username=${username}, webAppUser.username=${webAppUsername}`);
    
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
      console.error(`[telegram-auth] Updating username: telegramId=${telegramId}, old=${user.username}, new=${username}`);
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
