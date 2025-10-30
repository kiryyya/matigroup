import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { projects } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { addWatermarkToFile, getFileType } from '~/lib/watermark';

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
    
    // Получаем проект
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
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
    
    if (!attachment || attachment.length === 0) {
      return NextResponse.json(
        { error: 'Empty attachment' },
        { status: 400 }
      );
    }
    
    // Декодируем base64
    const fileBuffer = Buffer.from(attachment, 'base64') as Buffer;
    
    // Определяем MIME тип
    const mimeType = 'application/octet-stream'; // По умолчанию
    let fileName = `attachment_${attachmentIdx}`;
    
    // Попытка определить тип по содержимому
    if (fileBuffer.length > 0) {
      // PDF файлы начинаются с %PDF
      if (fileBuffer.subarray(0, 4).toString() === '%PDF') {
        fileName += '.pdf';
      }
      // ZIP файлы (PPTX) начинаются с PK
      else if (fileBuffer.subarray(0, 2).toString() === 'PK') {
        fileName += '.pptx';
      }
      // PPT файлы
      else if (fileBuffer.subarray(0, 8).toString() === '\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1') {
        fileName += '.ppt';
      }
    }
    
    let finalBuffer = fileBuffer;
    
    // Добавляем водяной знак если запрошено
    if (withWatermark) {
      try {
        console.log('Добавляем водяной знак к файлу:', { 
          fileName, 
          mimeType, 
          fileSize: fileBuffer.length,
          fileType: getFileType(mimeType)
        });
        
        finalBuffer = await addWatermarkToFile(fileBuffer, mimeType, {
          text: '123',
          opacity: 0.5,
          fontSize: 16,
        });
        
        console.log('Водяной знак успешно добавлен, новый размер:', finalBuffer.length);
      } catch (error) {
        console.error('Ошибка при добавлении водяного знака:', error);
        console.error('Детали ошибки:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          fileName,
          mimeType
        });
        // Если не удалось добавить водяной знак, возвращаем оригинальный файл
        finalBuffer = fileBuffer;
      }
    }
    
    // Определяем Content-Type
    let contentType = 'application/octet-stream';
    if (fileName.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (fileName.endsWith('.pptx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (fileName.endsWith('.ppt')) {
      contentType = 'application/vnd.ms-powerpoint';
    }
    
    // Возвращаем файл
    return new NextResponse(finalBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': finalBuffer.length.toString(),
      },
    });
    
  } catch (error) {
    console.error('Ошибка при скачивании файла:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
