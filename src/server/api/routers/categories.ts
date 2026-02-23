import { createTRPCRouter, procedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "~/server/db";
import { categories } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";

const createCategorySchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  slug: z.string().min(1, "Slug обязателен").regex(/^[a-z0-9-]+$/, "Slug может содержать только строчные буквы, цифры и дефисы"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Цвет должен быть в формате HEX (#RRGGBB)").optional(),
  backgroundImage: z.string().url("Неверный URL изображения").optional(),
});

const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.number(),
});

export const categoriesRouter = createTRPCRouter({
  // Получить все категории
  getAll: publicProcedure.query(async () => {
    return await db.query.categories.findMany({
      orderBy: [desc(categories.createdAt)],
    });
  }),

  // Получить категорию по ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, input.id),
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена",
        });
      }

      return category;
    }),

  // Создать категорию
  create: procedure
    .input(createCategorySchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Только администраторы могут создавать категории",
        });
      }

      // Проверяем, не существует ли уже категория с таким slug
      const existingCategory = await db.query.categories.findFirst({
        where: eq(categories.slug, input.slug),
      });

      if (existingCategory) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Категория с таким slug уже существует",
        });
      }

      const newCategory = await db
        .insert(categories)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          icon: input.icon,
          color: input.color,
          backgroundImage: input.backgroundImage,
        })
        .returning()
        .then((r) => r[0]);

      return newCategory;
    }),

  // Обновить категорию
  update: procedure
    .input(updateCategorySchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Только администраторы могут обновлять категории",
        });
      }

      const { id, ...updateData } = input;

      // Проверяем, существует ли категория
      const existingCategory = await db.query.categories.findFirst({
        where: eq(categories.id, id),
      });

      if (!existingCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена",
        });
      }

      // Если обновляется slug, проверяем, не занят ли он другой категорией
      if (updateData.slug && updateData.slug !== existingCategory.slug) {
        const categoryWithSlug = await db.query.categories.findFirst({
          where: eq(categories.slug, updateData.slug),
        });

        if (categoryWithSlug) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Категория с таким slug уже существует",
          });
        }
      }

      const updatedCategory = await db
        .update(categories)
        .set(updateData)
        .where(eq(categories.id, id))
        .returning()
        .then((r) => r[0]);

      return updatedCategory;
    }),

  // Удалить категорию
  delete: procedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Только администраторы могут удалять категории",
        });
      }

      // Проверяем, существует ли категория
      const existingCategory = await db.query.categories.findFirst({
        where: eq(categories.id, input.id),
      });

      if (!existingCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена",
        });
      }

      // Удаляем категорию (каскадное удаление проектов настроено в схеме)
      await db.delete(categories).where(eq(categories.id, input.id));

      return { success: true };
    }),
});
