"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import React, { useEffect, useMemo, useState } from "react";
import { X, Upload, FileText, File, Image as ImageIcon, FileVideo, FileAudio, Archive, ArrowUp, ArrowDown, Link as LinkIcon } from "lucide-react";
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

type EditableProject = {
  id: number;
  title: string;
  description?: string | null;
  content?: string | null;
  projectYear?: number | null;
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
  const [links, setLinks] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [uploadCount, setUploadCount] = useState(0);
  const [projectFilterValues, setProjectFilterValues] = useState<ProjectFilterValues>({});
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const isUploadingFiles = uploadCount > 0;
  const startUpload = () => setUploadCount((count) => count + 1);
  const endUpload = () => setUploadCount((count) => Math.max(0, count - 1));

  const { register, handleSubmit, reset, watch } = useForm<{ title: string; description?: string; content?: string; projectYear?: number; categoryId: number }>();
  const categoryField = register("categoryId", { valueAsNumber: true });
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
        projectYear: project.projectYear ?? undefined,
        categoryId: project.categoryId,
      });
      setImages(project.images ?? []);
      setLinks([]);
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

  const preserveScrollPosition = (update: () => void) => {
    const modalScrollTop = contentRef.current?.scrollTop ?? 0;
    const pageScrollTop = window.scrollY;
    update();
    requestAnimationFrame(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = modalScrollTop;
      }
      if (window.scrollY !== pageScrollTop) {
        window.scrollTo({ top: pageScrollTop });
      }
    });
  };

  const onSubmit = async (data: { title: string; description?: string; content?: string; projectYear?: number; categoryId: number }) => {
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
        projectYear: data.projectYear,
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

  const moveImage = (fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      next.splice(toIndex, 0, moved);
      return next;
    });
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

  const addLink = () => {
    const url = prompt("Введите ссылку:");
    if (url) {
      setLinks((prev) => [...prev, url]);
    }
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
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

  return (
    <Dialog open={isOpen}>
      <CustomDialogContent
        ref={contentRef}
        className="max-w-2xl max-h-full overflow-y-auto pt-28 pb-4"
      >
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
              <p className="text-xs text-muted-foreground">
                Опционально: поддерживается Markdown (заголовки, списки, таблицы и т.д.).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Подробное описание</Label>
              <Textarea id="content" {...register("content")} rows={5} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectYear">Год</Label>
              <Input
                id="projectYear"
                type="number"
                inputMode="numeric"
                min={1000}
                max={9999}
                placeholder="Например, 2024"
                {...register("projectYear", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) return undefined;
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : undefined;
                  },
                })}
              />
              <p className="text-xs text-muted-foreground">
                Укажите только год. Эта дата будет показываться в проекте.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория *</Label>
              <select
                id="category"
                name={categoryField.name}
                ref={categoryField.ref}
                onBlur={categoryField.onBlur}
                onChange={(e) =>
                  preserveScrollPosition(() => {
                    void categoryField.onChange(e);
                  })
                }
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
                    preserveScrollPosition(() => {
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
                    });
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
                  <div
                    key={`${image.key}-${index}`}
                    className={cn(
                      "flex min-w-0 flex-wrap items-center gap-2 rounded-md border p-2",
                      draggedImageIndex === index ? "opacity-60" : "",
                    )}
                    draggable
                    onDragStart={() => setDraggedImageIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedImageIndex === null) return;
                      moveImage(draggedImageIndex, index);
                      setDraggedImageIndex(null);
                    }}
                    onDragEnd={() => setDraggedImageIndex(null)}
                  >
                    <img
                      src={image.previewUrl ?? image.url}
                      alt={`Изображение ${index + 1}`}
                      className="h-16 w-16 rounded-md object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== image.url) {
                          target.src = image.url;
                        }
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {image.originalName ?? `Изображение ${index + 1}`}
                      </span>
                      {index === 0 && (
                        <span className="text-xs font-medium text-primary">Обложка проекта</span>
                      )}
                    </div>
                    <div className="ml-auto flex w-full justify-end gap-1 sm:w-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveImage(index, index - 1)}
                        disabled={index === 0}
                        title="Переместить выше"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveImage(index, index + 1)}
                        disabled={index === images.length - 1}
                        title="Переместить ниже"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeImage(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addImage} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />Добавить изображения
                </Button>
                {images.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Подсказка: перетаскивайте изображения мышкой или используйте стрелки для смены порядка.
                  </p>
                )}
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

            <div className="space-y-2">
              <Label>Ссылки</Label>
              <div className="space-y-2">
                {links.map((link, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    <span className="flex-1 text-sm truncate">{link}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeLink(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addLink} className="w-full">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Добавить ссылку
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


