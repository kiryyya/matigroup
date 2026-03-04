"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import React, { useEffect, useMemo, useState } from "react";
import { X, Upload, FileText, File, Image as ImageIcon, FileVideo, FileAudio, Archive } from "lucide-react";
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
import type { ProjectFilterValues } from "~/types/category-filters";

type EditableProject = {
  id: number;
  title: string;
  description?: string | null;
  content?: string | null;
  categoryId: number;
  images?: StoredImage[] | null;
  attachments?: StoredAttachment[] | null;
  featured?: boolean | null;
  status?: "draft" | "published" | "archived" | null;
  filterValues?: ProjectFilterValues | null;
};

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: EditableProject | null;
}

export default function EditProjectModal({ isOpen, onClose, project }: EditProjectModalProps) {
  const { data: categories } = api.projects.categories.useQuery();
  const utils = api.useUtils();
  const updateProject = api.projects.update.useMutation({
    onSuccess: async () => {
      // Инвалидируем и обновляем кэш для обновления списков
      await utils.projects.categories.invalidate();
      await utils.projects.categories.refetch();
      await utils.projects.featured.invalidate();
      await utils.projects.featured.refetch();
      await utils.projects.allProjects.invalidate();
      await utils.projects.allProjects.refetch();
      await utils.projects.favorites.invalidate();
      await utils.projects.favorites.refetch();
      // Важно: сбросить списки по категориям (и старой, и новой)
      await utils.projects.projectsByCategory.invalidate();
      if (project?.id) {
        await utils.projects.project.invalidate({ id: project.id });
        await utils.projects.project.refetch({ id: project.id });
        await utils.projects.projectFull.invalidate({ id: project.id });
        await utils.projects.projectFull.refetch({ id: project.id });
      }
    },
  });

  const [images, setImages] = useState<StoredImage[]>([]);
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [uploadCount, setUploadCount] = useState(0);
  const [projectFilterValues, setProjectFilterValues] = useState<ProjectFilterValues>({});

  const isUploadingFiles = uploadCount > 0;
  const startUpload = () => setUploadCount((count) => count + 1);
  const endUpload = () => setUploadCount((count) => Math.max(0, count - 1));

  const { register, handleSubmit, reset, watch } = useForm<{ title: string; description?: string; content?: string; categoryId: number }>();
  const selectedCategoryId = watch("categoryId");
  const selectedCategory = categories?.find((category) => category.id === selectedCategoryId);
  const categoryFilters = useMemo(
    () => selectedCategory?.filters ?? [],
    [selectedCategory?.filters],
  );
  const categoryFilterChoices = useMemo(
    () =>
      categoryFilters.flatMap((filter) =>
        (filter.options ?? []).map((option, index) => ({
          key: `${filter.id}-${index}`,
          filterId: filter.id,
          value: option,
        })),
      ),
    [categoryFilters],
  );

  // Инициализация значений при открытии
  useEffect(() => {
    if (project) {
      reset({
        title: project.title,
        description: project.description ?? undefined,
        content: project.content ?? undefined,
        categoryId: project.categoryId,
      });
      setImages(project.images ?? []);
      setAttachments(project.attachments ?? []);
      setProjectFilterValues(project.filterValues ?? {});
    }
  }, [project, reset]);

  useEffect(() => {
    setProjectFilterValues((prev) => {
      const current = Object.entries(prev).find(([filterId, value]) => {
        const filter = categoryFilters.find((item) => item.id === filterId);
        return Boolean(filter && value && filter.options.includes(value));
      });
      if (!current) {
        return {};
      }
      return { [current[0]]: current[1] };
    });
  }, [selectedCategoryId, categoryFilters]);

  const selectedCategoryFilterKey = useMemo(() => {
    const selected = Object.entries(projectFilterValues).find(([, value]) => Boolean(value));
    if (!selected) {
      return "";
    }
    return `${selected[0]}::${selected[1]}`;
  }, [projectFilterValues]);

  const onSubmit = async (data: { title: string; description?: string; content?: string; categoryId: number }) => {
    if (!project) return;
    const hasRequiredFilters = categoryFilters.some((filter) => filter.required);
    const hasSelectedFilter = Object.keys(projectFilterValues).length > 0;
    if (hasRequiredFilters && !hasSelectedFilter) {
      alert("Выберите одно значение фильтра категории");
      return;
    }

    setIsSaving(true);
      setSaveStatus("Сохранение изменений...");

    try {
      await updateProject.mutateAsync({
        id: project.id,
        title: data.title,
        description: data.description,
        content: data.content,
        categoryId: data.categoryId,
        images: images,
        attachments: attachments,
        filterValues: projectFilterValues,
      });

      setSaveStatus("Проект обновлен!");
      await new Promise(r => setTimeout(r, 400));
      onClose();
    } catch (e) {
      console.error("Ошибка обновления проекта:", e);
      setSaveStatus("Ошибка при сохранении");
      alert("Ошибка при сохранении проекта");
    } finally {
      setIsSaving(false);
      setSaveStatus("");
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const fileArray = Array.from(files);
        const processFiles = async () => {
          startUpload();
          
          const errors: Array<{ fileName: string; error: string }> = [];
          let successCount = 0;
          
          try {
            for (const file of fileArray) {
              try {
                if (file.size > 5 * 1024 * 1024) {
                  errors.push({ fileName: file.name, error: "Файл слишком большой. Максимальный размер: 5MB" });
                  continue;
                }
                
              const { width, height } = await getImageDimensions(file);
              const previewBlob = await createImagePreview(file, {
                maxWidth: 600,
                maxHeight: 600,
                quality: 0.7,
              });

              const PreviewFileCtor =
                (globalThis as any).File ?? (window as any).File;
              const previewFile: File = new PreviewFileCtor(
                [previewBlob],
                `preview-${file.name}`,
                { type: "image/jpeg" },
              );

              // Проверяем размер preview файла
              if (previewFile.size > 5 * 1024 * 1024) {
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
            endUpload();
          }
        };
        void processFiles();
      }
    };
    input.click();
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const addAttachments = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const fileArray = Array.from(files);
        const processFiles = async () => {
          startUpload();
          try {
            for (const file of fileArray) {
              if (file.size > 25 * 1024 * 1024) {
                alert(`Файл ${file.name} слишком большой. Максимальный размер: 25MB`);
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
        void processFiles();
      }
    };
    input.click();
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (["jpg","jpeg","png","gif","webp","svg"].includes(extension)) return <ImageIcon className="h-4 w-4" />;
    if (["mp4","avi","mov","wmv","flv","webm"].includes(extension)) return <FileVideo className="h-4 w-4" />;
    if (["mp3","wav","flac","aac","ogg"].includes(extension)) return <FileAudio className="h-4 w-4" />;
    if (["zip","rar","7z","tar","gz"].includes(extension)) return <Archive className="h-4 w-4" />;
    if (["pdf"].includes(extension)) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

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
          <DialogTitle>Редактировать проект</DialogTitle>
          <DialogDescription>
            Внесите изменения и сохраните проект
          </DialogDescription>
        </DialogHeader>

        {project && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Название проекта *</Label>
              <Input id="title" {...register("title")} placeholder="Введите название проекта" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Краткое описание</Label>
              <Textarea id="description" {...register("description")} rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Подробное описание</Label>
              <Textarea id="content" {...register("content")} rows={5} />
            </div>

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

            {categoryFilterChoices.length > 0 && (
              <div className="space-y-3">
                <Label htmlFor="project-filter-single">
                  Фильтр категории
                  {categoryFilters.some((filter) => filter.required) ? " *" : ""}
                </Label>
                <select
                  id="project-filter-single"
                  value={selectedCategoryFilterKey}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (!next) {
                      setProjectFilterValues({});
                      return;
                    }
                    const [filterId, value] = next.split("::");
                    if (!filterId || !value) {
                      setProjectFilterValues({});
                      return;
                    }
                    setProjectFilterValues({ [filterId]: value });
                  }}
                  className="w-full p-2 border border-input rounded-md bg-background"
                >
                  <option value="">Выберите значение</option>
                  {categoryFilterChoices.map((choice) => (
                    <option key={choice.key} value={`${choice.filterId}::${choice.value}`}>
                      {choice.value}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Изображения</Label>
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
                    <Button type="button" variant="outline" size="sm" onClick={() => removeImage(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addImage} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />Добавить изображения
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Вложения</Label>
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {getFileIcon(attachment.originalName)}
                    <span className="flex-1 text-sm truncate">{attachment.originalName}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeAttachment(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addAttachments} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />Добавить файлы
                </Button>
              </div>
            </div>

            {isSaving && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader size="sm" />
                {saveStatus && (
                  <span className="text-sm text-muted-foreground">{saveStatus}</span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSaving || isUploadingFiles}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSaving || updateProject.isPending || isUploadingFiles} className="flex-1">
                {isSaving || updateProject.isPending ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </form>
        )}
      </CustomDialogContent>
    </Dialog>
  );
}


