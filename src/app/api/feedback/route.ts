import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { requireTelegramUser } from "~/server/telegram-auth";
import { bot } from "~/server/telegram";
import { validateCSRF } from "~/lib/csrf";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_USERNAME = "kolesnikovkiko";

const feedbackSchema = z.object({
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1).max(2000),
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

    const targetUser = await db.query.users.findFirst({
      where: and(eq(users.username, TARGET_USERNAME), isNotNull(users.chatId)),
      columns: {
        chatId: true,
      },
    });

    if (!targetUser?.chatId) {
      return NextResponse.json(
        { error: `Пользователь @${TARGET_USERNAME} не найден или не активировал бота` },
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

    await bot.telegram.sendMessage(targetUser.chatId, text, {
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
