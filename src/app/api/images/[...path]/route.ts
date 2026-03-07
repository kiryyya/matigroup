import { NextRequest, NextResponse } from "next/server";
import { getPublicObject } from "~/lib/storage";

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

// Prevent static generation
export const dynamicParams = true;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function normalizeImageMimeType(contentType?: string): string | null {
  if (!contentType) {
    return null;
  }

  const rawMimeType = contentType.split(";")[0]?.trim().toLowerCase();
  const mimeType =
    rawMimeType === "image/jpg" || rawMimeType === "image/pjpeg"
      ? "image/jpeg"
      : rawMimeType;
  if (!mimeType) {
    return null;
  }

  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType) ? mimeType : null;
}

function buildImageResponse(
  bodyBuffer: Buffer,
  contentType: string,
) {
  return new NextResponse(bodyBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Cache successful image responses to avoid repeated S3/proxy hops.
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Length": bodyBuffer.length.toString(),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

async function convertToJpeg(bodyBuffer: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bodyBuffer).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

async function resolveImagePayload(s3Object: Awaited<ReturnType<typeof getPublicObject>>) {
  if (!s3Object.Body) {
    throw new Error("File not found");
  }

  let bodyBuffer = Buffer.from(await s3Object.Body.transformToByteArray());
  let contentType = normalizeImageMimeType(s3Object.ContentType);

  // Telegram Desktop can fail on some WebP/AVIF cases; fallback to JPEG.
  if (!contentType || contentType === "image/webp" || contentType === "image/avif") {
    const converted = await convertToJpeg(bodyBuffer);
    if (converted) {
      bodyBuffer = converted;
      contentType = "image/jpeg";
    }
  }

  if (!contentType) {
    return null;
  }
  return { bodyBuffer, contentType };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  try {
    // Await params if it's a Promise (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params;
    // Восстанавливаем путь к файлу из массива
    const key = resolvedParams.path.join('/');
    
    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    try {
      // Пытаемся получить файл из хранилища
      const s3Object = await getPublicObject({ key });
      
      const payload = await resolveImagePayload(s3Object);
      if (!payload) {
        return NextResponse.json(
          { error: "Unsupported image content type" },
          {
            status: 415,
            headers: {
              ...NO_STORE_HEADERS,
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      }

      return buildImageResponse(payload.bodyBuffer, payload.contentType);
    } catch (s3Error: unknown) {
      // Если это preview и файл не найден, пытаемся загрузить original
      if (key.includes('-preview-')) {
        const originalKey = key.replace('-preview-', '-original-');
        try {
          const s3Object = await getPublicObject({ key: originalKey });
          
          if (s3Object.Body) {
            const payload = await resolveImagePayload(s3Object);
            if (!payload) {
              return NextResponse.json(
                { error: "Unsupported image content type" },
                {
                  status: 415,
                  headers: {
                    ...NO_STORE_HEADERS,
                    "X-Content-Type-Options": "nosniff",
                  },
                },
              );
            }

            return buildImageResponse(payload.bodyBuffer, payload.contentType);
          }
        } catch (originalError) {
          // Если и original не найден, возвращаем ошибку
          console.error("Error fetching original image:", originalError);
        }
      }
      
      // Если не удалось загрузить, возвращаем ошибку
      console.error("Error fetching image:", s3Error);
      const message = s3Error instanceof Error ? s3Error.message : "Internal server error";
      return NextResponse.json(
        { error: message },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
  } catch (error) {
    console.error("Error in image proxy:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
