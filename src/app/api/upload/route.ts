import { NextRequest, NextResponse } from "next/server";
import { requireTelegramAdmin } from "~/server/telegram-auth";
import { uploadPrivateObject, uploadPublicObject, getPublicObject } from "~/lib/storage";
import { addWatermarkToImage } from "~/lib/watermark";
import { db } from "~/server/db";
import { settings } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { validateCSRF } from "~/lib/csrf";

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: NextRequest) {
  try {
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
    
    // Если это изображение и это оригинал (не preview), применяем водяной знак
    if (isImage && variant === "original") {
      try {
        // Загружаем настройки водяного знака из БД
        const watermarkSetting = await db.query.settings.findFirst({
          where: eq(settings.key, 'watermark'),
        });

        if (watermarkSetting) {
          const watermarkConfig = watermarkSetting.value as {
            enabled?: boolean;
            text?: string;
            opacity?: number;
            fontSize?: number;
            color?: { r: number; g: number; b: number };
            angle?: number;
            position?: string;
            useImage?: boolean;
            watermarkImageKey?: string;
          };

          // Применяем водяной знак, если он включен
          if (watermarkConfig.enabled !== false) {
            const imageBuffer = Buffer.from(body);
            
            // Если используется изображение, загружаем его из storage
            let watermarkImageBuffer: Buffer | undefined;
            if (watermarkConfig.useImage && watermarkConfig.watermarkImageKey) {
              try {
                const watermarkObject = await getPublicObject({ key: watermarkConfig.watermarkImageKey });
                if (watermarkObject.Body) {
                  const watermarkArrayBuffer = await watermarkObject.Body.transformToByteArray();
                  watermarkImageBuffer = Buffer.from(watermarkArrayBuffer);
                }
              } catch (error) {
                console.error("Ошибка загрузки изображения водяного знака:", error);
                // Продолжаем с текстовым водяным знаком
              }
            }
            
            const watermarkedBuffer = await addWatermarkToImage(imageBuffer, {
              enabled: watermarkConfig.enabled ?? true,
              text: watermarkConfig.text ?? 'Matigroup',
              opacity: watermarkConfig.opacity ?? 0.15,
              fontSize: watermarkConfig.fontSize ?? 48,
              color: watermarkConfig.color ?? { r: 0, g: 0, b: 0 },
              angle: watermarkConfig.angle ?? -45,
              position: (watermarkConfig.position as any) ?? 'center',
              imageWatermark: watermarkImageBuffer,
            });
            body = new Uint8Array(watermarkedBuffer);
          }
        }
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
