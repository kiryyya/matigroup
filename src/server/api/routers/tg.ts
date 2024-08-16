import { createTRPCRouter, procedure } from "~/server/api/trpc";

export const tgRouter = createTRPCRouter({
  getUser: procedure.query(async ({ ctx }) => {
    return ctx.user;
  }),
});
