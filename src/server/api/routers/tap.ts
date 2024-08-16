import { users } from "~/server/db/schema";
import { createTRPCRouter, procedure } from "../trpc";
import { desc, eq, sql } from "drizzle-orm";
import { bot } from "~/server/telegram";

export const tapRouter = createTRPCRouter({
  add: procedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(users)
      .set({
        tapCount: sql`${users.tapCount} + 1`,
      })
      .where(eq(users.id, ctx.user.id));
  }),
  getLeaderboard: procedure.query(async ({ ctx }) => {
    const leaderboard = await ctx.db
      .select()
      .from(users)
      .orderBy(desc(users.tapCount))
      .limit(20);
    return leaderboard;
  }),

  getTopupLink: procedure.query(async ({ ctx }) => {
    const invoiceLink = await bot.telegram.createInvoiceLink({
      currency: "XTR",
      payload: `${ctx.user.telegramId}-1`,
      provider_token: "",
      prices: [
        {
          label: `Purchase 1000 taps`,
          amount: 100,
        },
      ],
      title: `Purchase 1000 taps`,
      description: `Purchase 1000 taps`,
    });

    return invoiceLink;
  }),
});
