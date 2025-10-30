import { createTRPCRouter, procedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { ilike, or, eq } from "drizzle-orm";

export const tgRouter = createTRPCRouter({
  getUser: procedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  // Search users by name
  searchUsers: procedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can search users",
        });
      }

      const foundUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          telegramId: users.telegramId,
        })
        .from(users)
        .where(
          or(
            ilike(users.name, `%${input.query}%`),
            ilike(users.email, `%${input.query}%`)
          )
        )
        .limit(20);

      return foundUsers;
    }),

  // Update user role
  updateUserRole: procedure
    .input(z.object({ 
      userId: z.string(),
      role: z.enum(["admin", "user"])
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update user roles",
        });
      }

      // Нельзя изменить роль самому себе
      if (ctx.user.id === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role",
        });
      }

      const updatedUser = await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          telegramId: users.telegramId,
        });

      if (updatedUser.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return updatedUser[0];
    }),
});
