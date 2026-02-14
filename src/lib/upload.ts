export type UploadKind = "image" | "attachment";

export async function uploadFile(input: {
  file: File;
  kind: UploadKind;
  variant?: "original" | "preview";
}) {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("kind", input.kind);
  formData.append("variant", input.variant ?? "original");

  const initData =
    typeof window !== "undefined"
      ? window.Telegram?.WebApp?.initData ?? ""
      : "";

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "x-telegram-init-data": initData,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorText = "Upload failed";
      try {
        const text = await response.text();
        try {
          const errorJson = JSON.parse(text);
          errorText = errorJson.error || errorText;
        } catch {
          errorText = text || errorText;
        }
      } catch {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorText);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Network error during upload");
  }
}

export async function createImagePreview(
  file: File,
  options: { maxWidth: number; maxHeight: number; quality: number },
) {
  const image = document.createElement("img");
  const url = URL.createObjectURL(file);
  image.src = url;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image"));
  });

  const { width, height } = image;
  let targetWidth = width;
  let targetHeight = height;

  if (width > height && width > options.maxWidth) {
    targetWidth = options.maxWidth;
    targetHeight = Math.round((height * options.maxWidth) / width);
  } else if (height >= width && height > options.maxHeight) {
    targetHeight = options.maxHeight;
    targetWidth = Math.round((width * options.maxHeight) / height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Preview failed"))),
      "image/jpeg",
      options.quality,
    );
  });

  URL.revokeObjectURL(url);
  return blob;
}

export async function getImageDimensions(file: File) {
  const image = document.createElement("img");
  const url = URL.createObjectURL(file);
  image.src = url;

  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      image.onload = () => resolve({ width: image.width, height: image.height });
      image.onerror = () => reject(new Error("Failed to read image size"));
    },
  );

  URL.revokeObjectURL(url);
  return dimensions;
}

export function classifyAttachment(mimeType: string, name: string) {
  const lower = name.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "document";
  if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z")) return "archive";
  return "other";
}
