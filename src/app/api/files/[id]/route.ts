import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getPrivateObject, getPublicObject } from "~/lib/storage";
import { requireTelegramUser } from "~/server/telegram-auth";
import { validateCSRF } from "~/lib/csrf";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{
    id: string;
  }> | {
    id: string;
  };
}

function mapStorageError(error: unknown): { status: number; message: string } {
  const fallback = { status: 500, message: "Failed to retrieve file from storage" };
  if (!error || typeof error !== "object") return fallback;

  const err = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const code = err.name ?? "";
  const message = err.message ?? fallback.message;
  const httpStatus = err.$metadata?.httpStatusCode;

  if (code === "NoSuchKey" || code === "NotFound" || httpStatus === 404) {
    return { status: 404, message: "File not found in storage" };
  }
  if (code === "AccessDenied" || httpStatus === 403) {
    return { status: 502, message: "Storage access denied" };
  }

  return { status: 500, message };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const ip = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(`files:${ip}`, {
      windowMs: 60_000,
      maxRequests: 120,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many download requests" },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfterSeconds.toString(),
          },
        },
      );
    }

    // CSRF защита (для GET запросов проверка менее строгая, но все равно проверяем Origin)
    try {
      validateCSRF(request);
    } catch (csrfError) {
      // Для GET запросов CSRF ошибка не критична, только логируем
      console.warn("CSRF warning for file download:", csrfError);
    }
    
    const user = await requireTelegramUser(request.headers);
    const { searchParams } = new URL(request.url);
    const withWatermark = searchParams.get('watermark') === 'true';
    const attachmentIndex = searchParams.get('attachmentIndex');
    
    if (!attachmentIndex) {
      return NextResponse.json(
        { error: 'Attachment index is required' },
        { status: 400 }
      );
    }
    
    const projectId = parseInt(resolvedParams.id);
    const attachmentIdx = parseInt(attachmentIndex);
    
    if (isNaN(projectId) || isNaN(attachmentIdx)) {
      return NextResponse.json(
        { error: 'Invalid project ID or attachment index' },
        { status: 400 }
      );
    }
    
    // Получаем проект (проверяем статус для не-админов)
    const project = await db.query.projects.findFirst({
      where: user.role === "admin"
        ? eq(projects.id, projectId)
        : and(eq(projects.id, projectId), eq(projects.status, "published")),
      columns: { attachments: true, title: true },
    });
    
    if (!project || !project.attachments || project.attachments.length === 0) {
      return NextResponse.json(
        { error: 'Project or attachments not found' },
        { status: 404 }
      );
    }
    
    if (attachmentIdx >= project.attachments.length) {
      return NextResponse.json(
        { error: 'Attachment index out of range' },
        { status: 400 }
      );
    }
    
    const attachment = project.attachments[attachmentIdx];
    
    if (!attachment) {
      return NextResponse.json(
        { error: 'Empty attachment' },
        { status: 400 }
      );
    }
    
    if (typeof attachment === "string") {
      return NextResponse.json(
        { error: "Legacy attachment format is not supported here" },
        { status: 400 },
      );
    }

    const fileKey = attachment.key;
    if (!fileKey) {
      return NextResponse.json(
        { error: 'File key is missing' },
        { status: 400 }
      );
    }

    const fileName = attachment.originalName || `attachment_${attachmentIdx}`;
    const mimeType = attachment.mimeType || "application/octet-stream";

    // Функция для безопасного кодирования имени файла для HTTP заголовков
    const encodeFileName = (name: string): string => {
      // Проверяем, содержит ли имя файла не-ASCII символы
      const hasNonAscii = /[^\x00-\x7F]/.test(name);
      
      if (hasNonAscii) {
        // Используем RFC 5987 encoding для не-ASCII символов
        const encoded = encodeURIComponent(name);
        return `filename*=UTF-8''${encoded}`;
      }
      
      // Для ASCII символов используем обычный формат
      return `filename="${name.replace(/"/g, '\\"')}"`;
    };

    try {
      let s3Object;
      try {
        s3Object = await getPrivateObject({ key: fileKey });
      } catch (privateError) {
        // Backward-compatible fallback for old uploads/misconfigured private bucket.
        // The route is still auth-protected, so this does not bypass access control.
        console.warn("Private storage fetch failed, trying public bucket fallback:", privateError);
        s3Object = await getPublicObject({ key: fileKey });
      }

      if (!s3Object.Body) {
        return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
      }

      const bodyBuffer = Buffer.from(await s3Object.Body.transformToByteArray());
      let finalBuffer: Buffer = bodyBuffer;

    if (withWatermark) {
      try {
          // Lazy import: avoid loading heavy watermark dependencies for normal downloads.
          const { addWatermarkToFile } = await import("~/lib/watermark");
          const watermarked = await addWatermarkToFile(bodyBuffer, mimeType, {
            text: "123",
          opacity: 0.5,
          fontSize: 16,
        });
          finalBuffer = Buffer.isBuffer(watermarked)
            ? watermarked
            : Buffer.from(watermarked);
      } catch (error) {
          console.error("Ошибка при добавлении водяного знака:", error);
          finalBuffer = bodyBuffer;
        }
      }
    
    return new NextResponse(finalBuffer as BodyInit, {
      status: 200,
      headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; ${encodeFileName(fileName)}`,
          "Content-Length": finalBuffer.length.toString(),
      },
    });
    } catch (storageError) {
      console.error("Ошибка при получении файла из storage:", storageError);
      const mapped = mapStorageError(storageError);
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status }
      );
    }
    
  } catch (error) {
    console.error("Ошибка при скачивании файла:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
