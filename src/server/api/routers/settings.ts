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
  fontSizePercent: z.number().min(1).max(100).optional(), // Размер шрифта в процентах от размера изображения
  color: z.object({
    r: z.number().min(0).max(255).default(0),
    g: z.number().min(0).max(255).default(0),
    b: z.number().min(0).max(255).default(0),
  }).optional(),
  angle: z.number().min(-180).max(180).default(-45),
  position: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'repeat']).default('center'),
  watermarkImageKey: z.string().optional(), // Ключ изображения водяного знака в storage
  useImage: z.boolean().default(false), // Использовать изображение вместо текста
  imageSizePercent: z.number().min(1).max(100).default(20), // Размер изображения-водяного знака в процентах от минимальной стороны
});

const feedbackRecipientSettingsSchema = z.object({
  telegramUsername: z
    .string()
    .trim()
    .min(1, "Ник обязателен")
    .max(64, "Ник слишком длинный")
    .transform((value) => value.replace(/^@+/, "")),
});

export const settingsRouter = createTRPCRouter({
  getFeedbackRecipientSettings: procedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can view settings",
      });
    }

    const setting = await db.query.settings.findFirst({
      where: eq(settings.key, "feedback_recipient"),
    });

    const parsed = feedbackRecipientSettingsSchema.safeParse(setting?.value);
    return {
      telegramUsername: parsed.success ? parsed.data.telegramUsername : "kolesnikovkiko",
    };
  }),

  updateFeedbackRecipientSettings: procedure
    .input(feedbackRecipientSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update settings",
        });
      }

      const existing = await db.query.settings.findFirst({
        where: eq(settings.key, "feedback_recipient"),
      });

      if (existing) {
        await db
          .update(settings)
          .set({
            value: input,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(settings.key, "feedback_recipient"));
      } else {
        await db.insert(settings).values({
          key: "feedback_recipient",
          value: input,
          updatedBy: ctx.user.id,
        });
      }

      return { success: true };
    }),

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
        fontSizePercent: undefined,
        color: { r: 0, g: 0, b: 0 },
        angle: -45,
        position: 'center' as const,
        useImage: false,
        watermarkImageKey: undefined,
        imageSizePercent: 20,
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
            fontSizePercent: undefined,
            color: { r: 0, g: 0, b: 0 },
            angle: -45,
            position: 'center' as const,
            useImage: false,
            watermarkImageKey: undefined,
            imageSizePercent: 20,
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
