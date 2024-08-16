import { Telegraf } from "telegraf";
import { env } from "~/env";

export const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
