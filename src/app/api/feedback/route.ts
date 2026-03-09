import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/server/db";
import { settings, users } from "~/server/db/schema";
import { requireTelegramUser } from "~/server/telegram-auth";
import { bot } from "~/server/telegram";
import { validateCSRF } from "~/lib/csrf";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TARGET_USERNAME = "kolesnikovkiko";

const feedbackSchema = z.object({
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1).max(2000),
});

const feedbackRecipientSchema = z.object({
  telegramUsername: z.string().trim().min(1).max(64).transform((value) => value.replace(/^@+/, "")),
});

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(`feedback:${ip}`, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many feedback requests" },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfterSeconds.toString(),
          },
        },
      );
    }

    validateCSRF(request);
    const sender = await requireTelegramUser(request.headers);

    const parsed = feedbackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Невалидные данные формы" }, { status: 400 });
    }

    const { subject, message } = parsed.data;
    const recipientSetting = await db.query.settings.findFirst({
      where: eq(settings.key, "feedback_recipient"),
    });
    const parsedRecipient = feedbackRecipientSchema.safeParse(recipientSetting?.value);
    const normalizedTargetUsername = (
      parsedRecipient.success
        ? parsedRecipient.data.telegramUsername
        : DEFAULT_TARGET_USERNAME
    ).replace(/^@+/, "");

    let targetChatId: string | null = null;

    const targetUser = await db.query.users.findFirst({
      where: and(ilike(users.username, normalizedTargetUsername), isNotNull(users.chatId)),
      columns: {
        chatId: true,
      },
    });
    if (targetUser?.chatId) {
      targetChatId = targetUser.chatId;
    }

    // Fallback: ask Telegram API directly by username if DB username was not synced yet.
    if (!targetChatId) {
      try {
        const chat = await bot.telegram.getChat(`@${normalizedTargetUsername}`);
        targetChatId = String(chat.id);
      } catch (error) {
        console.warn("Cannot resolve feedback target via bot API:", error);
      }
    }

    if (!targetChatId) {
      return NextResponse.json(
        { error: `Пользователь @${normalizedTargetUsername} не найден или не активировал бота` },
        { status: 503 },
      );
    }

    const senderLabel = sender.username
      ? `@${sender.username}`
      : sender.name || sender.telegramId || sender.id;

    const text = [
      "<b>Новая обратная связь</b>",
      "",
      `<b>От:</b> ${escapeTelegramHtml(senderLabel)}`,
      `<b>Telegram ID:</b> ${escapeTelegramHtml(sender.telegramId ?? "unknown")}`,
      ...(subject ? [`<b>Тема:</b> ${escapeTelegramHtml(subject)}`] : []),
      "",
      "<b>Сообщение:</b>",
      escapeTelegramHtml(message),
    ].join("\n");

    await bot.telegram.sendMessage(targetChatId, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback send error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
