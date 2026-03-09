import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";
import { requireTelegramUser } from "~/server/telegram-auth";
import { validateCSRF } from "~/lib/csrf";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";
import { getPrivateObject, getPublicObject } from "~/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

type ProjectImageLike = {
  key?: string;
  originalName?: string;
};

type ProjectAttachmentLike = {
  key?: string;
  originalName?: string;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "file";
}

function tryParseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseLegacyStorageKey(rawValue: string, folder: "images" | "attachments"): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(`${folder}/`)) return trimmed;

  const marker = `${folder}/`;
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex >= 0) {
    const fromMarker = trimmed.slice(markerIndex).split("?")[0]?.split("#")[0] ?? "";
    return fromMarker || null;
  }

  return null;
}

function inferFileNameFromKey(key: string, fallbackPrefix: string, index: number): string {
  const tail = key.split("/").pop() ?? `${fallbackPrefix}_${index + 1}`;
  return sanitizeFileName(decodeURIComponent(tail));
}

async function readStorageObject(key: string, isAttachment: boolean): Promise<Buffer> {
  if (!isAttachment) {
    const object = await getPublicObject({ key });
    if (!object.Body) throw new Error("Image body is empty");
    return Buffer.from(await object.Body.transformToByteArray());
  }

  try {
    const object = await getPrivateObject({ key });
    if (!object.Body) throw new Error("Attachment body is empty");
    return Buffer.from(await object.Body.transformToByteArray());
  } catch {
    const fallback = await getPublicObject({ key });
    if (!fallback.Body) throw new Error("Attachment body is empty");
    return Buffer.from(await fallback.Body.transformToByteArray());
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const projectId = Number.parseInt(resolvedParams.id, 10);
    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const ip = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(`project-archive:${ip}`, {
      windowMs: 60_000,
      maxRequests: 20,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many archive download requests" },
        {
          status: 429,
          headers: { "Retry-After": rateLimitResult.retryAfterSeconds.toString() },
        },
      );
    }

    try {
      validateCSRF(request);
    } catch (csrfError) {
      console.warn("CSRF warning for archive download:", csrfError);
    }

    const user = await requireTelegramUser(request.headers);
    const project = await db.query.projects.findFirst({
      where:
        user.role === "admin"
          ? eq(projects.id, projectId)
          : and(eq(projects.id, projectId), eq(projects.status, "published")),
      columns: {
        title: true,
        images: true,
        attachments: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const imagesRaw = tryParseArray(project.images);
    const attachmentsRaw = tryParseArray(project.attachments);
    if (imagesRaw.length === 0 && attachmentsRaw.length === 0) {
      return NextResponse.json({ error: "No files to archive" }, { status: 404 });
    }

    const zip = new JSZip();
    const imagesFolder = zip.folder("images");
    const attachmentsFolder = zip.folder("attachments");
    const usedFileNames = new Set<string>();

    const reserveUniqueName = (baseName: string) => {
      const sanitized = sanitizeFileName(baseName);
      if (!usedFileNames.has(sanitized)) {
        usedFileNames.add(sanitized);
        return sanitized;
      }

      const dotIndex = sanitized.lastIndexOf(".");
      const hasExt = dotIndex > 0;
      const name = hasExt ? sanitized.slice(0, dotIndex) : sanitized;
      const ext = hasExt ? sanitized.slice(dotIndex) : "";
      let counter = 2;
      while (true) {
        const candidate = `${name}_${counter}${ext}`;
        if (!usedFileNames.has(candidate)) {
          usedFileNames.add(candidate);
          return candidate;
        }
        counter += 1;
      }
    };

    for (let i = 0; i < imagesRaw.length; i += 1) {
      const item = imagesRaw[i];
      let key: string | null = null;
      let name = `image_${i + 1}`;

      if (typeof item === "string") {
        key = parseLegacyStorageKey(item, "images");
      } else if (item && typeof item === "object") {
        const image = item as ProjectImageLike;
        key = image.key ?? null;
        if (image.originalName) {
          name = image.originalName;
        }
      }

      if (!key) continue;

      try {
        const body = await readStorageObject(key, false);
        const fileName = reserveUniqueName(
          name.includes(".") ? name : inferFileNameFromKey(key, "image", i),
        );
        imagesFolder?.file(fileName, body);
      } catch (error) {
        console.error("Failed to include image in archive:", key, error);
      }
    }

    for (let i = 0; i < attachmentsRaw.length; i += 1) {
      const item = attachmentsRaw[i];
      let key: string | null = null;
      let name = `attachment_${i + 1}`;

      if (typeof item === "string") {
        key = parseLegacyStorageKey(item, "attachments");
      } else if (item && typeof item === "object") {
        const attachment = item as ProjectAttachmentLike;
        key = attachment.key ?? null;
        if (attachment.originalName) {
          name = attachment.originalName;
        }
      }

      if (!key) continue;

      try {
        const body = await readStorageObject(key, true);
        const fileName = reserveUniqueName(
          name.includes(".") ? name : inferFileNameFromKey(key, "attachment", i),
        );
        attachmentsFolder?.file(fileName, body);
      } catch (error) {
        console.error("Failed to include attachment in archive:", key, error);
      }
    }

    const generated = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    if (!generated.length) {
      return NextResponse.json({ error: "Failed to build archive" }, { status: 500 });
    }

    const archiveName = sanitizeFileName(project.title || `project_${projectId}`);
    const finalName = `${archiveName}.zip`;

    return new NextResponse(generated as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(finalName)}`,
        "Content-Length": generated.length.toString(),
      },
    });
  } catch (error) {
    console.error("Project archive error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
