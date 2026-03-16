"use client";

import { api } from "~/trpc/react";
// Card components removed as they're not used in this file
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React, { useState } from "react";
import { Plus, X, Upload, FileText, Link as LinkIcon, File, Image as ImageIcon, FileVideo, FileAudio, Archive } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from "~/components/ui/dialog";
import Loader from "~/components/ui/loader";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "~/lib/utils";
import type { StoredAttachment, StoredImage } from "~/types/files";
import {
  classifyAttachment,
  createImagePreview,
  getImageDimensions,
  uploadFile,
} from "~/lib/upload";

const projectSchema = z.object({
  title: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  content: z.string().optional(),
  categoryId: z.number().min(1, "Выберите категорию"),
  links: z.array(z.string().url("Неверный URL")).optional(),
  pdfFiles: z.array(z.string()).optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const { data: categories } = api.projects.categories.useQuery();
  const utils = api.useUtils();
  const createProject = api.projects.create.useMutation({
    onSuccess: async () => {
      // Инвалидируем кэш для обновления списков
      await utils.projects.categories.invalidate();
      await utils.projects.featured.invalidate();
      await utils.projects.allProjects.invalidate();
      await utils.projects.favorites.invalidate();
      await utils.projects.projectsByCategory.invalidate();
    },
  });

  const [images, setImages] = useState<StoredImage[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  const isUploadingFiles = uploadCount > 0;
  const startUpload = () => setUploadCount((count) => count + 1);
  const endUpload = () => setUploadCount((count) => Math.max(0, count - 1));

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<ProjectFormData>();

  const onSubmit = async (data: ProjectFormData) => {
    // Простая валидация
    if (!data.title.trim()) {
      alert("Название проекта обязательно");
      return;
    }
    if (!data.categoryId) {
      alert("Выберите категорию");
      return;
    }

    setIsSaving(true);
    setSaveStatus("Сохранение проекта...");

    try {
      await createProject.mutateAsync({
        title: data.title,
        description: data.description || undefined,
        content: data.content || undefined,
        categoryId: data.categoryId,
        images: images.length > 0 ? images : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        status: "published",
        featured: false,
      });

      setSaveStatus("Проект успешно создан!");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Сброс формы
      reset();
      setImages([]);
      setLinks([]);
      setAttachments([]);
      
      onClose();
    } catch (error) {
      console.error("Ошибка создания проекта:", error);
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      setSaveStatus("Ошибка при создании проекта");
      
      // Показываем детальную ошибку
      let userMessage = "Ошибка при создании проекта";
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        userMessage = "У вас нет прав для создания проекта";
      } else if (errorMessage.includes("validation") || errorMessage.includes("invalid")) {
        userMessage = `Ошибка валидации: ${errorMessage}`;
      } else if (errorMessage.includes("database") || errorMessage.includes("SQL")) {
        userMessage = "Ошибка базы данных. Проверьте данные проекта";
      } else if (errorMessage) {
        userMessage = `Ошибка: ${errorMessage}`;
      }
      
      alert(userMessage);
    } finally {
      setIsSaving(false);
      setSaveStatus("");
    }
  };

  const addImage = () => {
    if (images.length < 10) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) {
          const fileArray = Array.from(files);
          
        const processFiles = async () => {
          setIsProcessingImages(true);
          startUpload();
          
          const errors: Array<{ fileName: string; error: string }> = [];
          let successCount = 0;
          
          try {
            for (const file of fileArray) {
              try {
                if (file.size > 50 * 1024 * 1024) {
                  errors.push({ fileName: file.name, error: "Файл слишком большой. Максимальный размер: 50MB" });
                  continue;
                }
                
                const { width, height } = await getImageDimensions(file);
                const previewBlob = await createImagePreview(file, {
                  maxWidth: 600,
                  maxHeight: 600,
                  quality: 0.7,
                });

                // Используем глобальный File-конструктор через any,
                // чтобы избежать проблем типизации при сборке
                const PreviewFileCtor =
                  (globalThis as any).File ?? (window as any).File;
                const previewFile: File = new PreviewFileCtor(
                  [previewBlob],
                  `preview-${file.name}`,
                  { type: "image/jpeg" },
                );

                // Проверяем размер preview файла
                if (previewFile.size > 50 * 1024 * 1024) {
                  errors.push({ fileName: file.name, error: "Preview файл слишком большой после обработки" });
                  continue;
                }

                const [originalUpload, previewUpload] = await Promise.all([
                  uploadFile({ file, kind: "image", variant: "original" }),
                  uploadFile({ file: previewFile, kind: "image", variant: "preview" }),
                ]);

                setImages((prev) => [
                  ...prev,
                  {
                    key: originalUpload.key,
                    url: originalUpload.url,
                    previewUrl: previewUpload.url,
                    size: originalUpload.size,
                    mimeType: originalUpload.mimeType,
                    width,
                    height,
                    originalName: originalUpload.originalName,
                  },
                ]);
                
                successCount++;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
                errors.push({ fileName: file.name, error: errorMessage });
                console.error(`Ошибка загрузки изображения ${file.name}:`, error);
              }
            }
            
            // Показываем результаты
            if (errors.length > 0) {
              const errorDetails = errors.map(e => `• ${e.fileName}: ${e.error}`).join('\n');
              alert(`Не удалось загрузить ${errors.length} из ${fileArray.length} файлов:\n\n${errorDetails}`);
            } else if (successCount > 0) {
              // Все успешно загружены
              console.log(`Успешно загружено ${successCount} изображений`);
            }
          } catch (error) {
            console.error("Критическая ошибка при обработке файлов:", error);
            alert("Произошла критическая ошибка при загрузке изображений");
          } finally {
            setIsProcessingImages(false);
            endUpload();
          }
        };
        
        void processFiles();
        }
      };
      input.click();
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const addLink = () => {
    const url = prompt("Введите ссылку:");
    if (url) {
      setLinks([...links, url]);
    }
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const addAttachments = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*'; // Разрешаем любые файлы
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const fileArray = Array.from(files);
        const uploadAttachments = async () => {
          startUpload();
          try {
            for (const file of fileArray) {
              if (file.size > 50 * 1024 * 1024) {
                alert(`Файл ${file.name} слишком большой. Максимальный размер: 50MB`);
                continue;
              }
              const uploaded = await uploadFile({ file, kind: "attachment" });
              const kind = classifyAttachment(file.type || "", file.name);
              setAttachments((prev) => [
                ...prev,
                {
                  key: uploaded.key,
                  size: uploaded.size,
                  mimeType: uploaded.mimeType,
                  originalName: uploaded.originalName,
                  kind,
                },
              ]);
            }
          } catch (error) {
            console.error("Ошибка загрузки файла:", error);
            alert("Не удалось загрузить файл");
          } finally {
            endUpload();
            }
          };

        void uploadAttachments();
      }
    };
    input.click();
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      return <ImageIcon className="h-4 w-4" />;
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
      return <FileVideo className="h-4 w-4" />;
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) {
      return <FileAudio className="h-4 w-4" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
      return <Archive className="h-4 w-4" />;
    }
    if (['pdf'].includes(extension)) {
      return <FileText className="h-4 w-4" />;
    }
    
    return <File className="h-4 w-4" />;
  };

  // Кастомный DialogContent без крестика
  const CustomDialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
  >(({ className, children, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  ));
  CustomDialogContent.displayName = "CustomDialogContent";

  return (
    <Dialog open={isOpen}>
      <CustomDialogContent className="max-w-2xl max-h-full overflow-y-auto pt-28 pb-20">
        <DialogHeader>
          <DialogTitle>Создать новый проект</DialogTitle>
          <DialogDescription>
            Заполните форму для добавления нового проекта
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Название проекта */}
          <div className="space-y-2">
            <Label htmlFor="title">Название проекта *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Введите название проекта"
            />
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="description">Краткое описание</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Краткое описание проекта"
              rows={3}
            />
          </div>

          {/* Подробное описание */}
          <div className="space-y-2">
            <Label htmlFor="content">Подробное описание</Label>
            <Textarea
              id="content"
              {...register("content")}
              placeholder="Подробное описание проекта (HTML поддерживается)"
              rows={5}
            />
          </div>

          {/* Категория */}
          <div className="space-y-2">
            <Label htmlFor="category">Категория *</Label>
            <select
              id="category"
              {...register("categoryId", { valueAsNumber: true })}
              className="w-full p-2 border border-input rounded-md bg-background"
            >
              <option value="">Выберите категорию</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Изображения */}
          <div className="space-y-2">
            <Label>Изображения (до 10)</Label>
            <div className="space-y-2">
              {images.map((image, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Image
                    src={image.previewUrl ?? image.url}
                    alt={`Изображение ${index + 1}`}
                    width={64}
                    height={64}
                    className="w-16 h-16 object-cover rounded-md"
                  />
                  <span className="flex-1 text-sm truncate">Изображение {index + 1}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {images.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addImage}
                  disabled={isProcessingImages || isUploadingFiles}
                  className="w-full"
                >
                  {isProcessingImages ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Выбрать изображения
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Ссылки */}
          <div className="space-y-2">
            <Label>Ссылки</Label>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  <span className="flex-1 text-sm truncate">{link}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLink(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addLink}
                className="w-full"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Добавить ссылку
              </Button>
            </div>
          </div>

          {/* Вложения */}
          <div className="space-y-2">
            <Label>Вложения (любые файлы)</Label>
            <div className="space-y-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-2">
                  {getFileIcon(file.originalName)}
                  <span className="flex-1 text-sm truncate">{file.originalName}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addAttachments}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Выбрать файлы
              </Button>
            </div>
          </div>

          {/* Индикатор сохранения */}
          {isSaving && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader size="sm" />
              {saveStatus && (
                <span className="text-sm text-muted-foreground">{saveStatus}</span>
              )}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSaving || isUploadingFiles}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSaving || createProject.isPending || isUploadingFiles}
              className="flex-1"
            >
              {isSaving ? "Сохранение..." : createProject.isPending ? "Сохранение..." : "Сохранить проект"}
            </Button>
          </div>
        </form>
      </CustomDialogContent>
    </Dialog>
  );
}
