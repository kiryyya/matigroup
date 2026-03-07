import { NextRequest, NextResponse } from "next/server";
import { requireTelegramAdmin } from "~/server/telegram-auth";
import { uploadPrivateObject, uploadPublicObject, getPublicObject } from "~/lib/storage";
import { addWatermarkToImage } from "~/lib/watermark";
import { db } from "~/server/db";
import { settings } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { validateCSRF } from "~/lib/csrf";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type WatermarkConfig = {
  enabled?: boolean;
  text?: string;
  opacity?: number;
  fontSize?: number;
  fontSizePercent?: number;
  color?: { r: number; g: number; b: number };
  angle?: number;
  position?: string;
  useImage?: boolean;
  watermarkImageKey?: string;
  imageSizePercent?: number;
};

const DEFAULT_WATERMARK: Required<
  Pick<WatermarkConfig, "text" | "opacity" | "color" | "angle" | "position" | "imageSizePercent">
> = {
  text: "Matigroup",
  opacity: 0.15,
  color: { r: 0, g: 0, b: 0 },
  angle: -45,
  position: "center",
  imageSizePercent: 20,
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(`upload:${ip}`, {
      windowMs: 60_000,
      maxRequests: 30,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many upload requests" },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfterSeconds.toString(),
          },
        },
      );
    }

    // CSRF защита
    validateCSRF(request);
    
    await requireTelegramAdmin(request.headers);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kind = (formData.get("kind") as string | null) ?? "attachment";
    const variant = (formData.get("variant") as string | null) ?? "original";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const isImage = kind === "image";
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_ATTACHMENT_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File is too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let body = new Uint8Array(arrayBuffer);
    
    // Для изображений водяной знак применяем всегда (к original и preview).
    if (isImage) {
      try {
        const watermarkSetting = await db.query.settings.findFirst({
          where: eq(settings.key, 'watermark'),
        });
        const watermarkConfig = (watermarkSetting?.value as WatermarkConfig | undefined) ?? {};
        const imageBuffer = Buffer.from(body);

        // Если выбран watermark-логотип, пробуем использовать его; иначе fallback на текстовый.
        let watermarkImageBuffer: Buffer | undefined;
        if (watermarkConfig.useImage && watermarkConfig.watermarkImageKey) {
          try {
            const watermarkObject = await getPublicObject({ key: watermarkConfig.watermarkImageKey });
            if (watermarkObject.Body) {
              watermarkImageBuffer = Buffer.from(await watermarkObject.Body.transformToByteArray());
            } else {
              console.warn("Изображение watermark не найдено, fallback на текст");
            }
          } catch (error) {
            console.error("Ошибка загрузки watermark-изображения, fallback на текст:", error);
          }
        }

        const useImageWatermark = watermarkConfig.useImage === true && watermarkImageBuffer !== undefined;

        const watermarkedBuffer = await addWatermarkToImage(imageBuffer, {
          enabled: true, // Принудительно всегда включен для изображений.
          text: useImageWatermark ? undefined : (watermarkConfig.text ?? DEFAULT_WATERMARK.text),
          opacity: watermarkConfig.opacity ?? DEFAULT_WATERMARK.opacity,
          fontSize: watermarkConfig.fontSize,
          fontSizePercent: watermarkConfig.fontSizePercent,
          color: watermarkConfig.color ?? DEFAULT_WATERMARK.color,
          angle: watermarkConfig.angle ?? DEFAULT_WATERMARK.angle,
          position: (watermarkConfig.position as any) ?? DEFAULT_WATERMARK.position,
          imageWatermark: useImageWatermark ? watermarkImageBuffer : undefined,
          imageSizePercent: watermarkConfig.imageSizePercent ?? DEFAULT_WATERMARK.imageSizePercent,
        });
        body = new Uint8Array(watermarkedBuffer);
      } catch (error) {
        console.error("Ошибка при применении водяного знака:", error);
        // Продолжаем с оригинальным изображением в случае ошибки
      }
    }

    const safeName = sanitizeFileName(file.name || "file");
    const id = crypto.randomUUID();
    const key = isImage
      ? `images/${id}-${variant}-${safeName}`
      : `attachments/${id}-${safeName}`;

    if (isImage) {
      const url = await uploadPublicObject({
        key,
        body,
        contentType: file.type || "application/octet-stream",
      });

      return NextResponse.json({
        key,
        url,
        size: body.length,
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
        variant,
      });
    }

    await uploadPrivateObject({
      key,
      body,
      contentType: file.type || "application/octet-stream",
    });

    return NextResponse.json({
      key,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      variant,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
