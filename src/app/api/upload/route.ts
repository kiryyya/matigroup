import { NextRequest, NextResponse } from "next/server";
import { requireTelegramAdmin } from "~/server/telegram-auth";
import { uploadPrivateObject, uploadPublicObject } from "~/lib/storage";

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: NextRequest) {
  try {
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
    const body = new Uint8Array(arrayBuffer);
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
        size: file.size,
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
