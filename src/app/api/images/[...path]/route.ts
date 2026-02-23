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

  const mimeType = contentType.split(";")[0]?.trim().toLowerCase();
  if (!mimeType) {
    return null;
  }

  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType) ? mimeType : null;
}

function buildImageResponse(bodyBuffer: Buffer, contentType: string) {
  return new NextResponse(bodyBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": bodyBuffer.length.toString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
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
      
      if (!s3Object.Body) {
        throw new Error("File not found");
      }

      // Преобразуем тело в буфер
      const bodyBuffer = Buffer.from(await s3Object.Body.transformToByteArray());

      const contentType = normalizeImageMimeType(s3Object.ContentType);
      if (!contentType) {
        return NextResponse.json(
          { error: "Unsupported image content type" },
          { status: 415, headers: { "X-Content-Type-Options": "nosniff" } },
        );
      }

      return buildImageResponse(bodyBuffer, contentType);
    } catch (s3Error: unknown) {
      // Если это preview и файл не найден, пытаемся загрузить original
      if (key.includes('-preview-')) {
        const originalKey = key.replace('-preview-', '-original-');
        try {
          const s3Object = await getPublicObject({ key: originalKey });
          
          if (s3Object.Body) {
            const bodyBuffer = Buffer.from(await s3Object.Body.transformToByteArray());
            const contentType = normalizeImageMimeType(s3Object.ContentType);
            if (!contentType) {
              return NextResponse.json(
                { error: "Unsupported image content type" },
                { status: 415, headers: { "X-Content-Type-Options": "nosniff" } },
              );
            }

            return buildImageResponse(bodyBuffer, contentType);
          }
        } catch (originalError) {
          // Если и original не найден, возвращаем ошибку
          console.error("Error fetching original image:", originalError);
        }
      }
      
      // Если не удалось загрузить, возвращаем ошибку
      console.error("Error fetching image:", s3Error);
      const message = s3Error instanceof Error ? s3Error.message : "Internal server error";
      return NextResponse.json({ error: message }, { status: 404 });
    }
  } catch (error) {
    console.error("Error in image proxy:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
