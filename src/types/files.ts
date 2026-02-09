export type StoredImage = {
  key: string;
  url: string;
  previewUrl?: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  originalName?: string;
};

export type StoredAttachment = {
  key: string;
  size: number;
  mimeType: string;
  originalName: string;
  kind: "document" | "archive" | "audio" | "video" | "image" | "other";
};
