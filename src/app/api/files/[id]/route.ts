import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";
import { and, eq } from "drizzle-orm";
import { addWatermarkToFile } from "~/lib/watermark";
import { getPrivateObject } from "~/lib/storage";
import { requireTelegramUser } from "~/server/telegram-auth";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
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
    
    const projectId = parseInt(params.id);
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
    const fileName = attachment.originalName || `attachment_${attachmentIdx}`;
    const mimeType = attachment.mimeType || "application/octet-stream";

    const s3Object = await getPrivateObject({ key: fileKey });
    if (!s3Object.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const bodyBuffer = Buffer.from(await s3Object.Body.transformToByteArray());
    let finalBuffer = bodyBuffer;

    if (withWatermark) {
      try {
        finalBuffer = await addWatermarkToFile(bodyBuffer, mimeType, {
          text: "123",
          opacity: 0.5,
          fontSize: 16,
        });
      } catch (error) {
        console.error("Ошибка при добавлении водяного знака:", error);
        finalBuffer = bodyBuffer;
      }
    }

    return new NextResponse(finalBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": finalBuffer.length.toString(),
      },
    });
    
  } catch (error) {
    console.error("Ошибка при скачивании файла:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
