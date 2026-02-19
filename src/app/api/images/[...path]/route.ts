import { NextRequest, NextResponse } from "next/server";
import { getPublicObject } from "~/lib/storage";

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

// Prevent static generation
export const dynamicParams = true;

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
      
      // Определяем Content-Type из метаданных или по расширению
      const contentType = s3Object.ContentType || 'application/octet-stream';
      
      return new NextResponse(bodyBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": bodyBuffer.length.toString(),
        },
      });
    } catch (s3Error: unknown) {
      // Если это preview и файл не найден, пытаемся загрузить original
      if (key.includes('-preview-')) {
        const originalKey = key.replace('-preview-', '-original-');
        try {
          const s3Object = await getPublicObject({ key: originalKey });
          
          if (s3Object.Body) {
            const bodyBuffer = Buffer.from(await s3Object.Body.transformToByteArray());
            const contentType = s3Object.ContentType || 'application/octet-stream';
            
            return new NextResponse(bodyBuffer, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Length": bodyBuffer.length.toString(),
              },
            });
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
