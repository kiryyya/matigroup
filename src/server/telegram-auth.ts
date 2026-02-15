import { webcrypto } from "crypto";
import { TelegramWebApps } from "telegram-webapps-types";
import { env } from "~/env";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function getTelegramUserFromHeaders(headers: Headers) {
  const initData = headers.get("x-telegram-init-data");
  if (!initData) {
    return null;
  }

  const data = Object.fromEntries(new URLSearchParams(initData));
  const isValid = await isHashValid(data, env.TELEGRAM_BOT_TOKEN);
  if (!isValid) {
    return null;
  }

  const webAppUser = JSON.parse(
    data.user ?? "null",
  ) as TelegramWebApps.WebAppUser;

  if (!webAppUser?.id) {
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

async function checkOrCreateUser(webAppUser: TelegramWebApps.WebAppUser) {
  if (!webAppUser.id) {
    return null;
  }

  const telegramId = webAppUser.id.toString();

  let user = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });

  if (!user) {
    // Нормализуем username: если пустая строка, то null
    const username = webAppUser.username && webAppUser.username.trim() !== "" 
      ? webAppUser.username.trim() 
      : null;
    
    console.log(`[telegram-auth] Creating user: telegramId=${telegramId}, username=${username}, webAppUser.username=${webAppUser.username}`);
    
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
    const newUsername = webAppUser.username && webAppUser.username.trim() !== "" 
      ? webAppUser.username.trim() 
      : null;
    
    // Обновляем только если username изменился
    if (user.username !== newUsername) {
      console.log(`[telegram-auth] Updating username: telegramId=${telegramId}, old=${user.username}, new=${newUsername}`);
      await db
        .update(users)
        .set({ username: newUsername })
        .where(eq(users.telegramId, telegramId));
      // Обновляем локальный объект user
      user = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId),
      }) ?? user;
    }
  }

  return user;
}
