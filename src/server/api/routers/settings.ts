import { createTRPCRouter, procedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "~/server/db";
import { settings } from "~/server/db/schema";
import { eq } from "drizzle-orm";

const watermarkSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  text: z.string().min(1).max(100).optional(),
  opacity: z.number().min(0).max(1).default(0.15),
  fontSize: z.number().min(10).max(200).default(48),
  color: z.object({
    r: z.number().min(0).max(255).default(0),
    g: z.number().min(0).max(255).default(0),
    b: z.number().min(0).max(255).default(0),
  }).optional(),
  angle: z.number().min(-180).max(180).default(-45),
  position: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'repeat']).default('center'),
  watermarkImageKey: z.string().optional(), // Ключ изображения водяного знака в storage
  useImage: z.boolean().default(false), // Использовать изображение вместо текста
});

export const settingsRouter = createTRPCRouter({
  // Получить настройки водяного знака
  getWatermarkSettings: procedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can view settings",
      });
    }

    const setting = await db.query.settings.findFirst({
      where: eq(settings.key, 'watermark'),
    });

    if (!setting) {
      // Возвращаем настройки по умолчанию
      return {
        enabled: true,
        text: 'Matigroup',
        opacity: 0.15,
        fontSize: 48,
        color: { r: 0, g: 0, b: 0 },
        angle: -45,
        position: 'center' as const,
        useImage: false,
        watermarkImageKey: undefined,
      };
    }

    const settingsValue = setting.value as z.infer<typeof watermarkSettingsSchema>;
    return {
      ...settingsValue,
      useImage: settingsValue.useImage ?? false,
      watermarkImageKey: settingsValue.watermarkImageKey,
    };
  }),

  // Сохранить настройки водяного знака
  updateWatermarkSettings: procedure
    .input(watermarkSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update settings",
        });
      }

      const existing = await db.query.settings.findFirst({
        where: eq(settings.key, 'watermark'),
      });

      if (existing) {
        await db
          .update(settings)
          .set({
            value: input,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(settings.key, 'watermark'));
      } else {
        await db.insert(settings).values({
          key: 'watermark',
          value: input,
          updatedBy: ctx.user.id,
        });
      }

      return { success: true };
    }),

  // Загрузить изображение водяного знака
  uploadWatermarkImage: procedure
    .input(z.object({
      imageKey: z.string(), // Ключ уже загруженного изображения
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update settings",
        });
      }

      // Получаем текущие настройки
      const existing = await db.query.settings.findFirst({
        where: eq(settings.key, 'watermark'),
      });

      const currentSettings = existing 
        ? (existing.value as z.infer<typeof watermarkSettingsSchema>)
        : {
            enabled: true,
            text: 'Matigroup',
            opacity: 0.15,
            fontSize: 48,
            color: { r: 0, g: 0, b: 0 },
            angle: -45,
            position: 'center' as const,
            useImage: false,
            watermarkImageKey: undefined,
          };

      // Обновляем настройки с новым ключом изображения
      const updatedSettings = {
        ...currentSettings,
        watermarkImageKey: input.imageKey,
        useImage: true, // Автоматически включаем использование изображения
      };

      if (existing) {
        await db
          .update(settings)
          .set({
            value: updatedSettings,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(settings.key, 'watermark'));
      } else {
        await db.insert(settings).values({
          key: 'watermark',
          value: updatedSettings,
          updatedBy: ctx.user.id,
        });
      }

      return { success: true, imageKey: input.imageKey };
    }),
});
