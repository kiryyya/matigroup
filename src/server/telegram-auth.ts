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
  
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error('[telegram-auth] getTelegramUserFromHeaders: TELEGRAM_BOT_TOKEN is missing!');
    return null;
  }
  
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

  // Детальное логирование для диагностики
  console.error('[telegram-auth] isHashValid: Starting validation');
  console.error('[telegram-auth] isHashValid: Data keys:', Object.keys(data).join(', '));
  console.error('[telegram-auth] isHashValid: BotToken length:', botToken.length);
  console.error('[telegram-auth] isHashValid: BotToken (first 15):', botToken.substring(0, 15) + '...');

  // Формируем checkString согласно документации Telegram
  // Исключаем hash и signature, сортируем ключи, объединяем через \n
  const keysToCheck = Object.keys(data)
    .filter((key) => key !== "hash" && key !== "signature")
    .sort();
  
  console.error('[telegram-auth] isHashValid: Keys to check (sorted):', keysToCheck.join(', '));
  
  const checkString = keysToCheck
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  console.error('[telegram-auth] isHashValid: checkString length:', checkString.length);
  console.error('[telegram-auth] isHashValid: checkString (first 200 chars):', checkString.substring(0, 200));
  console.error('[telegram-auth] isHashValid: checkString (escaped newlines):', checkString.replace(/\n/g, '\\n').substring(0, 200));

  // Шаг 1: Создаем секретный ключ для "WebAppData"
  const secretKey = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Шаг 2: Вычисляем промежуточный ключ (HMAC от botToken)
  const secret = await webcrypto.subtle.sign(
    "HMAC",
    secretKey,
    encoder.encode(botToken),
  );

  console.error('[telegram-auth] isHashValid: Secret length:', secret.byteLength);

  // Шаг 3: Создаем ключ для финальной подписи
  const signatureKey = await webcrypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Шаг 4: Вычисляем финальную подпись
  const signature = await webcrypto.subtle.sign(
    "HMAC",
    signatureKey,
    encoder.encode(checkString),
  );

  // Конвертируем в hex
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  console.error('[telegram-auth] isHashValid: Calculated hash (full):', hex);
  console.error('[telegram-auth] isHashValid: Provided hash:', data.hash || '(missing)');
  console.error('[telegram-auth] isHashValid: Provided signature:', data.signature || '(missing)');
  
  // Проверяем hash (он должен быть в hex)
  const hashMatch = data.hash ? data.hash === hex : false;
  
  // Проверяем signature (он может быть в base64, нужно декодировать)
  let signatureMatch = false;
  if (data.signature) {
    try {
      // Пробуем декодировать base64
      const signatureBytes = Buffer.from(data.signature, 'base64');
      const signatureHex = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      signatureMatch = signatureHex === hex;
      console.error('[telegram-auth] isHashValid: Signature (decoded from base64):', signatureHex);
      console.error('[telegram-auth] isHashValid: Signature match (base64 decoded):', signatureMatch);
    } catch (e) {
      // Если не base64, пробуем как hex
      signatureMatch = data.signature === hex;
      console.error('[telegram-auth] isHashValid: Signature (as hex):', data.signature);
      console.error('[telegram-auth] isHashValid: Signature match (as hex):', signatureMatch);
    }
  }
  
  const match = hashMatch || signatureMatch;
  
  console.error('[telegram-auth] isHashValid: Hash match:', hashMatch);
  console.error('[telegram-auth] isHashValid: Signature match:', signatureMatch);
  console.error('[telegram-auth] isHashValid: Final match:', match);
  
  if (!match) {
    console.error('[telegram-auth] isHashValid: VALIDATION FAILED');
    console.error('[telegram-auth] isHashValid: Calculated:', hex);
    console.error('[telegram-auth] isHashValid: Provided hash:', data.hash);
    console.error('[telegram-auth] isHashValid: Provided signature:', data.signature);
  }
  
  return match;
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
