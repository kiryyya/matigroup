import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';

export interface WatermarkOptions {
  text: string;
  opacity?: number;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  angle?: number;
}

const DEFAULT_WATERMARK_OPTIONS: WatermarkOptions = {
  text: '123',
  opacity: 0.1, // Сделаем более прозрачным
  fontSize: 24, // Уменьшим размер
  color: { r: 0, g: 0, b: 0 },
  angle: -45,
};

/**
 * Добавляет водяной знак в PDF файл
 */
export async function addWatermarkToPDF(
  pdfBuffer: Buffer,
  options: Partial<WatermarkOptions> = {}
): Promise<Buffer> {
  const watermarkOptions = { ...DEFAULT_WATERMARK_OPTIONS, ...options };
  
  try {
    // Загружаем PDF документ
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    // Получаем шрифт
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Добавляем водяной знак на каждую страницу
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      
      // Вычисляем позицию для центрирования водяного знака
      const textWidth = font.widthOfTextAtSize(watermarkOptions.text, watermarkOptions.fontSize!);
      const textHeight = watermarkOptions.fontSize!;
      
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Рисуем водяной знак по центру страницы
      page.drawText(watermarkOptions.text, {
        x: centerX - textWidth / 2,
        y: centerY - textHeight / 2,
        size: watermarkOptions.fontSize!,
        font,
        color: rgb(
          watermarkOptions.color!.r,
          watermarkOptions.color!.g,
          watermarkOptions.color!.b
        ),
        opacity: watermarkOptions.opacity,
      });
    });
    
    // Добавляем метаданные
    pdfDoc.setTitle(`Документ с водяным знаком - ${watermarkOptions.text}`);
    pdfDoc.setSubject(`Водяной знак: ${watermarkOptions.text}`);
    pdfDoc.setKeywords([watermarkOptions.text, 'watermark']);
    pdfDoc.setProducer('Matigroup Watermark System');
    pdfDoc.setCreator('Matigroup');
    
    // Возвращаем модифицированный PDF
    return Buffer.from(await pdfDoc.save());
  } catch (error) {
    console.error('Ошибка при добавлении водяного знака в PDF:', error);
    throw new Error('Не удалось добавить водяной знак в PDF');
  }
}

/**
 * Добавляет водяной знак в PowerPoint презентацию
 */
export async function addWatermarkToPresentation(
  pptxBuffer: Buffer,
  options: Partial<WatermarkOptions> = {}
): Promise<Buffer> {
  const watermarkOptions = { ...DEFAULT_WATERMARK_OPTIONS, ...options };
  
  try {
    // Создаем новую презентацию с водяным знаком
    const pptx = new PptxGenJS();
    
    // Добавляем слайд с водяным знаком
    const slide = pptx.addSlide();
    
    // Добавляем водяной знак как текст на весь слайд
    slide.addText(watermarkOptions.text, {
      x: '50%',
      y: '50%',
      w: '100%',
      h: '100%',
      fontSize: watermarkOptions.fontSize,
      color: `rgba(${watermarkOptions.color!.r}, ${watermarkOptions.color!.g}, ${watermarkOptions.color!.b}, ${watermarkOptions.opacity})`,
      align: 'center',
      valign: 'middle',
      rotate: watermarkOptions.angle,
      fontFace: 'Arial',
    });
    
    // Добавляем основной контент поверх водяного знака
    slide.addText('Презентация с водяным знаком', {
      x: '50%',
      y: '50%',
      w: '80%',
      h: '20%',
      fontSize: 24,
      color: '000000',
      align: 'center',
      valign: 'middle',
      fontFace: 'Arial',
    });
    
    // Добавляем метаданные
    pptx.author = 'Matigroup';
    pptx.company = 'Matigroup';
    pptx.subject = `Презентация с водяным знаком - ${watermarkOptions.text}`;
    pptx.title = `Документ с водяным знаком - ${watermarkOptions.text}`;
    
    // Генерируем презентацию
    const pptxBuffer = await pptx.writeFile();
    
    return Buffer.from(pptxBuffer);
  } catch (error) {
    console.error('Ошибка при добавлении водяного знака в презентацию:', error);
    // Если не удалось создать презентацию с водяным знаком, возвращаем оригинальный файл
    return pptxBuffer;
  }
}

/**
 * Определяет тип файла по MIME типу
 */
export function getFileType(mimeType: string): 'pdf' | 'presentation' | 'other' {
  if (mimeType.includes('pdf')) {
    return 'pdf';
  }
  
  if (mimeType.includes('presentation') || 
      mimeType.includes('powerpoint') || 
      mimeType.includes('pptx') || 
      mimeType.includes('ppt')) {
    return 'presentation';
  }
  
  return 'other';
}

/**
 * Добавляет водяной знак в файл в зависимости от его типа
 */
export async function addWatermarkToFile(
  fileBuffer: Buffer,
  mimeType: string,
  options: Partial<WatermarkOptions> = {}
): Promise<Buffer> {
  const fileType = getFileType(mimeType);
  
  switch (fileType) {
    case 'pdf':
      return addWatermarkToPDF(fileBuffer, options);
    case 'presentation':
      return addWatermarkToPresentation(fileBuffer, options);
    default:
      // Для других типов файлов возвращаем оригинальный буфер
      return fileBuffer;
  }
}
