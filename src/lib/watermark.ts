import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';

export interface WatermarkOptions {
  text: string;
  opacity?: number;
  fontSize?: number;
  fontSizePercent?: number; // Размер шрифта в процентах от минимальной стороны изображения
  color?: { r: number; g: number; b: number };
  angle?: number;
  // Новые опции для изображений
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'repeat';
  imageWatermark?: Buffer; // Изображение-водяной знак (логотип)
  enabled?: boolean; // Включен ли водяной знак
  imageSizePercent?: number; // Размер изображения-водяного знака в процентах от минимальной стороны
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
  sourceBuffer: Buffer,
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
    
    // Генерируем презентацию как бинарный поток
    const rendered = await pptx.write({ outputType: "arraybuffer" as any });

    let renderedBuffer: Buffer;
    if (Buffer.isBuffer(rendered)) {
      renderedBuffer = rendered;
    } else if (rendered instanceof Uint8Array) {
      renderedBuffer = Buffer.from(rendered);
    } else if (rendered instanceof ArrayBuffer) {
      renderedBuffer = Buffer.from(new Uint8Array(rendered));
    } else {
      // строка или Blob — пытаемся привести к строке и затем к Buffer
      renderedBuffer = Buffer.from(String(rendered));
    }

    return renderedBuffer;
  } catch (error) {
    console.error('Ошибка при добавлении водяного знака в презентацию:', error);
    // Если не удалось создать презентацию с водяным знаком, возвращаем оригинальный файл
    return sourceBuffer;
  }
}

/**
 * Добавляет водяной знак на изображение используя Sharp
 */
export async function addWatermarkToImage(
  imageBuffer: Buffer,
  options: Partial<WatermarkOptions> = {}
): Promise<Buffer> {
  const watermarkOptions = { ...DEFAULT_WATERMARK_OPTIONS, ...options };
  
  // Если водяной знак отключен, возвращаем оригинал
  if (watermarkOptions.enabled === false) {
    return imageBuffer;
  }
  
  try {
    // Получаем размеры исходного изображения
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    // Если есть изображение-водяной знак, используем его
    if (watermarkOptions.imageWatermark) {
      try {
        return await addImageWatermark(imageBuffer, watermarkOptions.imageWatermark, {
          opacity: watermarkOptions.opacity || 0.3,
          position: watermarkOptions.position || 'center',
          angle: watermarkOptions.angle || 0,
          sizePercent: watermarkOptions.imageSizePercent || 20,
        });
      } catch (error) {
        console.error('Ошибка при применении изображения водяного знака, используем текстовый:', error);
        // Если ошибка с изображением, продолжаем с текстом
      }
    }
    
    // Создаем SVG с текстовым водяным знаком
    // Если нет текста, используем текст по умолчанию
    const watermarkText = watermarkOptions.text || 'Matigroup';
    
    // Вычисляем размер шрифта: либо из fontSize, либо из fontSizePercent, либо по умолчанию
    let fontSize: number;
    if (watermarkOptions.fontSize) {
      fontSize = watermarkOptions.fontSize;
    } else if (watermarkOptions.fontSizePercent) {
      fontSize = Math.min(width, height) * (watermarkOptions.fontSizePercent / 100);
    } else {
      fontSize = Math.min(width, height) / 10;
    }
    const svgText = createWatermarkSVG(
      watermarkText,
      fontSize,
      watermarkOptions.color || { r: 0, g: 0, b: 0 },
      watermarkOptions.opacity || 0.1,
      watermarkOptions.angle || -45,
      width,
      height,
      watermarkOptions.position || 'center'
    );
    
    // Накладываем SVG на изображение
    const watermarked = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(svgText),
          blend: 'over',
        },
      ])
      .toBuffer();
    
    return watermarked;
  } catch (error) {
    console.error('Ошибка при добавлении водяного знака на изображение:', error);
    // В случае ошибки возвращаем оригинальное изображение
    return imageBuffer;
  }
}

/**
 * Создает SVG с текстовым водяным знаком
 */
function createWatermarkSVG(
  text: string,
  fontSize: number,
  color: { r: number; g: number; b: number },
  opacity: number,
  angle: number,
  width: number,
  height: number,
  position: string
): string {
  const rgbColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
  
  // Вычисляем позицию в зависимости от параметра
  let x = width / 2;
  let y = height / 2;
  let textAnchor = 'middle';
  
  switch (position) {
    case 'top-left':
      x = width * 0.1;
      y = height * 0.1;
      textAnchor = 'start';
      break;
    case 'top-right':
      x = width * 0.9;
      y = height * 0.1;
      textAnchor = 'end';
      break;
    case 'bottom-left':
      x = width * 0.1;
      y = height * 0.9;
      textAnchor = 'start';
      break;
    case 'bottom-right':
      x = width * 0.9;
      y = height * 0.9;
      textAnchor = 'end';
      break;
    case 'repeat':
      // Для repeat создаем паттерн
      return createRepeatingWatermarkSVG(text, fontSize, rgbColor, opacity, angle, width, height);
    default: // center
      x = width / 2;
      y = height / 2;
      textAnchor = 'middle';
  }
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${x}, ${y}) rotate(${angle})">
        <text
          x="0"
          y="0"
          font-family="Arial, sans-serif"
          font-size="${fontSize}"
          fill="${rgbColor}"
          opacity="${opacity}"
          text-anchor="${textAnchor}"
          dominant-baseline="middle"
          font-weight="bold"
        >${escapeXml(text)}</text>
      </g>
    </svg>
  `;
}

/**
 * Создает повторяющийся водяной знак (паттерн)
 */
function createRepeatingWatermarkSVG(
  text: string,
  fontSize: number,
  color: string,
  opacity: number,
  angle: number,
  width: number,
  height: number
): string {
  const spacing = fontSize * 3; // Расстояние между водяными знаками
  
  const texts = [];
  for (let y = 0; y < height + spacing; y += spacing) {
    for (let x = 0; x < width + spacing; x += spacing) {
      texts.push(
        `<text
          x="${x}"
          y="${y}"
          font-family="Arial, sans-serif"
          font-size="${fontSize}"
          fill="${color}"
          opacity="${opacity}"
          text-anchor="middle"
          dominant-baseline="middle"
          transform="rotate(${angle} ${x} ${y})"
          font-weight="bold"
        >${escapeXml(text)}</text>`
      );
    }
  }
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${texts.join('\n')}
    </svg>
  `;
}

/**
 * Экранирует XML символы
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Добавляет изображение-водяной знак (например, логотип)
 */
async function addImageWatermark(
  imageBuffer: Buffer,
  watermarkImage: Buffer,
  options: { opacity: number; position: string; angle?: number; sizePercent?: number }
): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const watermark = sharp(watermarkImage);
  
  const imageMetadata = await image.metadata();
  const watermarkMetadata = await watermark.metadata();
  
  const imageWidth = imageMetadata.width || 0;
  const imageHeight = imageMetadata.height || 0;
  const watermarkWidth = watermarkMetadata.width || 0;
  const watermarkHeight = watermarkMetadata.height || 0;
  
  // Масштабируем водяной знак в процентах от минимальной стороны изображения
  const sizePercent = options.sizePercent || 20;
  const maxWatermarkSize = Math.min(imageWidth, imageHeight) * (sizePercent / 100);
  const scale = Math.min(
    maxWatermarkSize / watermarkWidth,
    maxWatermarkSize / watermarkHeight
  );
  
  const scaledWidth = Math.round(watermarkWidth * scale);
  const scaledHeight = Math.round(watermarkHeight * scale);
  
  // Применяем поворот и прозрачность
  let processedWatermark = watermark.resize(scaledWidth, scaledHeight);
  
  // Поворачиваем, если нужно
  if (options.angle && options.angle !== 0) {
    processedWatermark = processedWatermark.rotate(options.angle);
  }
  
  // Применяем прозрачность через composite с полупрозрачным слоем
  const watermarkProcessed = await processedWatermark
    .ensureAlpha()
    .toBuffer();
  
  // Создаем маску прозрачности через SVG
  const opacityMask = Buffer.from(
    `<svg width="${scaledWidth}" height="${scaledHeight}">
      <rect width="100%" height="100%" fill="white" opacity="${options.opacity}"/>
    </svg>`
  );
  
  // Применяем прозрачность через composite
  const watermarkWithOpacity = await sharp(watermarkProcessed)
    .composite([
      {
        input: opacityMask,
        blend: 'dest-in',
      },
    ])
    .toBuffer();
  
  // Вычисляем позицию
  let left = 0;
  let top = 0;
  
  switch (options.position) {
    case 'top-left':
      left = Math.round(imageWidth * 0.05);
      top = Math.round(imageHeight * 0.05);
      break;
    case 'top-right':
      left = Math.round(imageWidth - scaledWidth - imageWidth * 0.05);
      top = Math.round(imageHeight * 0.05);
      break;
    case 'bottom-left':
      left = Math.round(imageWidth * 0.05);
      top = Math.round(imageHeight - scaledHeight - imageHeight * 0.05);
      break;
    case 'bottom-right':
      left = Math.round(imageWidth - scaledWidth - imageWidth * 0.05);
      top = Math.round(imageHeight - scaledHeight - imageHeight * 0.05);
      break;
    default: // center
      left = Math.round((imageWidth - scaledWidth) / 2);
      top = Math.round((imageHeight - scaledHeight) / 2);
  }
  
  // Накладываем водяной знак
  return image
    .composite([
      {
        input: watermarkWithOpacity,
        left,
        top,
        blend: 'over',
      },
    ])
    .toBuffer();
}

/**
 * Определяет тип файла по MIME типу
 */
export function getFileType(mimeType: string): 'pdf' | 'presentation' | 'image' | 'other' {
  if (mimeType.includes('pdf')) {
    return 'pdf';
  }
  
  if (mimeType.includes('presentation') || 
      mimeType.includes('powerpoint') || 
      mimeType.includes('pptx') || 
      mimeType.includes('ppt')) {
    return 'presentation';
  }
  
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  return 'other';
}

/**
 * Добавляет водяной знак в файл в зависимости от его типа
 */
export async function addWatermarkToFile(
  fileBuffer: Buffer | Uint8Array,
  mimeType: string,
  options: Partial<WatermarkOptions> = {},
): Promise<Buffer> {
  const buffer = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : Buffer.from(fileBuffer);

  // Если водяной знак отключен, возвращаем оригинал
  if (options.enabled === false) {
    return buffer;
  }

  const fileType = getFileType(mimeType);
  
  switch (fileType) {
    case "image":
      return addWatermarkToImage(buffer, options);
    case "pdf":
      return addWatermarkToPDF(buffer, options);
    case "presentation":
      return addWatermarkToPresentation(buffer, options);
    default:
      // Для других типов файлов возвращаем оригинальный буфер
      return buffer;
  }
}
