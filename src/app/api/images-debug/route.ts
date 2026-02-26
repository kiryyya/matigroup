import { NextRequest, NextResponse } from "next/server";
import { getPublicObject } from "~/lib/storage";
import { requireTelegramAdmin } from "~/server/telegram-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function normalizeImageMimeType(contentType?: string): string | null {
  if (!contentType) return null;
  const rawMimeType = contentType.split(";")[0]?.trim().toLowerCase();
  const mimeType =
    rawMimeType === "image/jpg" || rawMimeType === "image/pjpeg"
      ? "image/jpeg"
      : rawMimeType;
  if (!mimeType) return null;
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType) ? mimeType : null;
}

async function canConvertToJpeg(bodyBuffer: Buffer) {
  try {
    const sharp = (await import("sharp")).default;
    const converted = await sharp(bodyBuffer).jpeg({ quality: 82 }).toBuffer();
    return { ok: true, size: converted.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "jpeg conversion failed",
    };
  }
}

function extractKey(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (value.startsWith("/api/images/")) {
    const noPrefix = value.slice("/api/images/".length);
    return noPrefix.split("?")[0] ?? "";
  }
  return value.split("?")[0] ?? "";
}

async function probeStorageKey(key: string) {
  try {
    const s3Object = await getPublicObject({ key });
    if (!s3Object.Body) {
      return { ok: false as const, key, error: "Body is empty" };
    }

    const bodyBuffer = Buffer.from(await s3Object.Body.transformToByteArray());
    const rawContentType = s3Object.ContentType ?? null;
    const normalizedContentType = normalizeImageMimeType(s3Object.ContentType);
    const needsJpegFallback =
      !normalizedContentType ||
      normalizedContentType === "image/webp" ||
      normalizedContentType === "image/avif";

    const jpegConversion = needsJpegFallback
      ? await canConvertToJpeg(bodyBuffer)
      : { ok: true as const, skipped: true };

    return {
      ok: true as const,
      key,
      objectExists: true,
      bytes: bodyBuffer.length,
      rawContentType,
      normalizedContentType,
      needsJpegFallback,
      jpegConversion,
    };
  } catch (error) {
    return {
      ok: false as const,
      key,
      objectExists: false,
      error: error instanceof Error ? error.message : "s3 read failed",
    };
  }
}

function withNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    await requireTelegramAdmin(request.headers);

    const keyInput = request.nextUrl.searchParams.get("key") ?? "";
    const key = extractKey(decodeURIComponent(keyInput));
    if (!key) {
      return withNoStoreHeaders(
        NextResponse.json({ error: "Query param 'key' is required" }, { status: 400 }),
      );
    }

    const originalKey = key.includes("-preview-")
      ? key.replace("-preview-", "-original-")
      : key;
    const previewKey = key.includes("-original-")
      ? key.replace("-original-", "-preview-")
      : key;

    const [requestedProbe, previewProbe, originalProbe] = await Promise.all([
      probeStorageKey(key),
      previewKey === key ? Promise.resolve(null) : probeStorageKey(previewKey),
      originalKey === key ? Promise.resolve(null) : probeStorageKey(originalKey),
    ]);

    const imageRouteDecision = (() => {
      if (requestedProbe.ok) {
        const contentType = requestedProbe.normalizedContentType;
        if (!contentType || contentType === "image/webp" || contentType === "image/avif") {
          return {
            expectedStatus: requestedProbe.jpegConversion.ok ? 200 : 415,
            reason: requestedProbe.jpegConversion.ok
              ? "will return jpeg fallback"
              : "unsupported MIME and jpeg conversion failed",
          };
        }
        return { expectedStatus: 200, reason: "requested key will be returned directly" };
      }

      if (key.includes("-preview-") && originalProbe?.ok) {
        const contentType = originalProbe.normalizedContentType;
        if (!contentType || contentType === "image/webp" || contentType === "image/avif") {
          return {
            expectedStatus: originalProbe.jpegConversion.ok ? 200 : 415,
            reason: originalProbe.jpegConversion.ok
              ? "preview missing, original will be returned as jpeg fallback"
              : "preview missing and original conversion failed",
          };
        }
        return {
          expectedStatus: 200,
          reason: "preview missing, original will be returned",
        };
      }

      return { expectedStatus: 404, reason: "requested key not found in storage" };
    })();

    return withNoStoreHeaders(
      NextResponse.json({
        key,
        keys: { requested: key, previewKey, originalKey },
        imageRouteDecision,
        probes: {
          requested: requestedProbe,
          preview: previewProbe,
          original: originalProbe,
        },
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return withNoStoreHeaders(NextResponse.json({ error: message }, { status }));
  }
}
