import { eq } from "drizzle-orm";
import { Context } from "telegraf";
import { getBaseUrl } from "~/lib/utils";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { bot } from "~/server/telegram";

const SECRET_HASH = "32e58fbahey833349df3383dc910e181";

bot.on("message", async (ctx) => {
  // echo the message
  await checkChatId(ctx);
  if ("text" in ctx.message) {
    await ctx.reply(ctx.message.text);
  } else {
    await ctx.reply("I don't know what to do with this message");
  }
});

bot.start(async (ctx) => {
  await checkChatId(ctx);

  // Получаем параметр start из команды
  const startParam = ctx.message?.text?.split(' ')[1] || '';
  console.log('Start command with param:', startParam);

  // URL для WebApp
  const webAppUrl = `${getBaseUrl()}`;
  
  // Создаем кнопку для открытия WebApp
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🚀 Открыть приложение",
          web_app: { url: webAppUrl }
        }
      ]
    ]
  };

  if (startParam) {
    // Если есть параметр, передаем его в WebApp
    const webAppUrlWithParam = `${webAppUrl}?start=${startParam}`;
    
    await ctx.reply(
      `Добро пожаловать! 🎉\n\nВы перешли по ссылке с параметром: ${startParam}\n\nНажмите кнопку ниже, чтобы открыть приложение:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Открыть приложение",
                web_app: { url: webAppUrlWithParam }
              }
            ]
          ]
        }
      }
    );
  } else {
    await ctx.reply(
      "Добро пожаловать! 🎉\n\nНажмите кнопку ниже, чтобы открыть приложение:",
      {
        reply_markup: keyboard
      }
    );
  }
});

bot.on("callback_query", async (ctx) => {
  await ctx.answerCbQuery("👍");

  console.log("CB Query", ctx.update.callback_query);

  const { data } = ctx.update.callback_query as { data: string };
  const [type, id] = data.split(":") as [string, string];

  /**
   * Here we would handle the callback query
   */

  await ctx.editMessageReplyMarkup({
    inline_keyboard: [],
  });
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("successful_payment", async (ctx) => {
  const payment = ctx.update.message.successful_payment;
  console.log("Successful payment!", payment);
  await ctx.telegram.sendMessage(ctx.chat.id, "You're all set! 🎉");

  const adminUsers = await db.query.users.findMany({
    where: eq(users.role, "admin"),
  });

  for (const user of adminUsers) {
    if (user.chatId) {
      await ctx.telegram.sendMessage(
        user.chatId,
        `New order! ${payment.order_info?.name}
${payment.total_amount} ${payment.currency}
        `,
      );
    }
  }
});

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const setWebhook = searchParams.get("setWebhook");

  if (setWebhook === "true") {
    const webhookUrl = `${getBaseUrl()}/api/webhooks/telegram?secret_hash=${SECRET_HASH}`;
    console.log("Setting webhook to", webhookUrl);
    await bot.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true,
    });
  }

  const hookInfo = await bot.telegram.getWebhookInfo();
  return Response.json({
    ...hookInfo,
    url: hookInfo.url?.replace(SECRET_HASH, "SECRET_HASH"),
  });
};

export const POST = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const secretHash = searchParams.get("secret_hash");

  if (secretHash !== SECRET_HASH) {
    return new Response("Unauthorized", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await bot.handleUpdate(body);

  return new Response("OK");
};
async function checkChatId(ctx: Context) {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  if (!chatId || !userId) {
    return;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.telegramId, userId.toString()),
  });

  if (!user) {
    await db.insert(users).values({
      telegramId: userId.toString(),
      chatId: chatId.toString(),
      name: ctx.from.first_name,
    });
  } else {
    if (user.chatId !== chatId.toString()) {
      await db
        .update(users)
        .set({
          chatId: chatId.toString(),
        })
        .where(eq(users.id, user.id));
    }
  }
}
