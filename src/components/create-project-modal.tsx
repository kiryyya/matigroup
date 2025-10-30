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
import { Progress } from "~/components/ui/progress";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "~/lib/utils";

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
    },
  });

  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentMetadata, setAttachmentMetadata] = useState<Array<{name: string, size: number, type: string}>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [isProcessingImages, setIsProcessingImages] = useState(false);

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
    setSaveProgress(0);
    setSaveStatus("Подготовка данных...");

    try {
      // Этап 1: Подготовка данных (20%)
      setSaveProgress(20);
      setSaveStatus("Подготовка данных...");
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('Создание проекта...', {
        title: data.title,
        imagesCount: images.length,
        attachmentsCount: attachments.length
      });

      // Этап 2: Валидация (40%)
      setSaveProgress(40);
      setSaveStatus("Проверка данных...");
      await new Promise(resolve => setTimeout(resolve, 200));

      // Этап 3: Сохранение в базу данных (80%)
      setSaveProgress(60);
      setSaveStatus("Сохранение проекта...");
      
      await createProject.mutateAsync({
        title: data.title,
        description: data.description,
        content: data.content,
        categoryId: data.categoryId,
        images: images,
        attachments: attachments,
        status: "published",
        featured: false,
      });

      // Этап 4: Завершение (100%)
      setSaveProgress(100);
      setSaveStatus("Проект успешно создан!");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Сброс формы
      reset();
      setImages([]);
      setImageFiles([]);
      setLinks([]);
      setAttachments([]);
      setAttachmentFiles([]);
      setAttachmentMetadata([]);
      
      onClose();
    } catch (error) {
      console.error("Ошибка создания проекта:", error);
      setSaveStatus("Ошибка при создании проекта");
      alert("Ошибка при создании проекта");
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
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
          setImageFiles(prev => [...prev, ...fileArray]);
          
        // Асинхронная обработка файлов
        const processFiles = async () => {
          setIsProcessingImages(true);
          try {
            for (const file of fileArray) {
              // Проверяем размер файла (максимум 2MB для быстрой обработки)
              if (file.size > 2 * 1024 * 1024) {
                alert(`Файл ${file.name} слишком большой. Максимальный размер: 2MB`);
                continue;
              }
              
              try {
                const compressedImage = await compressImage(file);
                setImages(prev => [...prev, compressedImage]);
              } catch (error) {
                console.error('Ошибка сжатия изображения:', error);
                // Fallback к обычному base64
                const reader = new FileReader();
                reader.onload = (e) => {
                  const result = e.target?.result as string;
                  if (result) {
                    setImages(prev => [...prev, result]);
                  }
                };
                reader.readAsDataURL(file);
              }
            }
          } finally {
            setIsProcessingImages(false);
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
    setImageFiles(imageFiles.filter((_, i) => i !== index));
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
      console.log('Выбранные файлы:', files);
      if (files) {
        const fileArray = Array.from(files);
        console.log('Массив файлов:', fileArray);
        setAttachmentFiles(prev => [...prev, ...fileArray]);
        
        // Сохраняем метаданные файлов
        const metadata = fileArray.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type
        }));
        setAttachmentMetadata(prev => [...prev, ...metadata]);
        
        fileArray.forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              setAttachments(prev => [...prev, result]);
            }
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
    setAttachmentFiles(attachmentFiles.filter((_, i) => i !== index));
    setAttachmentMetadata(attachmentMetadata.filter((_, i) => i !== index));
  };

  // Функция сжатия изображений
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img');
      
      img.onload = () => {
        try {
          // Устанавливаем максимальный размер (меньше для быстрой обработки)
          const maxWidth = 600;
          const maxHeight = 400;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Сжимаем до 70% качества для быстрой обработки
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
      img.src = URL.createObjectURL(file);
    });
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
      <CustomDialogContent className="max-w-2xl max-h-full overflow-y-auto pt-28 pb-4">
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
                    src={image}
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
                  disabled={isProcessingImages}
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
              {attachmentFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2">
                  {getFileIcon(file.name)}
                  <span className="flex-1 text-sm truncate">{file.name}</span>
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

          {/* Прогресс-бар сохранения */}
          {isSaving && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{saveStatus}</span>
                <span className="font-medium">{saveProgress}%</span>
              </div>
              <Progress value={saveProgress} className="w-full" />
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSaving || createProject.isPending}
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
