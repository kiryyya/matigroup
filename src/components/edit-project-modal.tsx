"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import React, { useEffect, useMemo, useState } from "react";
import { X, Upload, FileText, Link as LinkIcon, File, Image as ImageIcon, FileVideo, FileAudio, Archive } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from "~/components/ui/dialog";
import { Progress } from "~/components/ui/progress";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "~/lib/utils";

type EditableProject = {
  id: number;
  title: string;
  description?: string | null;
  content?: string | null;
  categoryId: number;
  images?: string[] | null;
  attachments?: string[] | null;
  featured?: boolean | null;
  status?: "draft" | "published" | "archived" | null;
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
      await utils.projects.categories.invalidate();
      await utils.projects.featured.invalidate();
      await utils.projects.allProjects.invalidate();
      await utils.projects.favorites.invalidate();
      // Важно: сбросить списки по категориям (и старой, и новой)
      await utils.projects.projectsByCategory.invalidate();
      if (project?.id) {
        await utils.projects.project.invalidate({ id: project.id });
        await utils.projects.projectFull.invalidate({ id: project.id });
      }
    },
  });

  const [images, setImages] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");

  const { register, handleSubmit, reset } = useForm<{ title: string; description?: string; content?: string; categoryId: number }>();

  // Инициализация значений при открытии
  useEffect(() => {
    if (project) {
      reset({
        title: project.title,
        description: project.description || undefined,
        content: project.content || undefined,
        categoryId: project.categoryId,
      });
      setImages(project.images || []);
      setAttachments(project.attachments || []);
    }
  }, [project, reset]);

  const onSubmit = async (data: { title: string; description?: string; content?: string; categoryId: number }) => {
    if (!project) return;

    setIsSaving(true);
    setSaveProgress(0);
    setSaveStatus("Подготовка данных...");

    try {
      setSaveProgress(40);
      setSaveStatus("Проверка данных...");

      setSaveProgress(70);
      setSaveStatus("Сохранение изменений...");

      await updateProject.mutateAsync({
        id: project.id,
        title: data.title,
        description: data.description,
        content: data.content,
        categoryId: data.categoryId,
        images: images,
        // attachments обновление опционально, если нужно — можно добавить на сервере
      });

      setSaveProgress(100);
      setSaveStatus("Проект обновлен!");
      await new Promise(r => setTimeout(r, 400));
      onClose();
    } catch (e) {
      console.error("Ошибка обновления проекта:", e);
      setSaveStatus("Ошибка при сохранении");
      alert("Ошибка при сохранении проекта");
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
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
        fileArray.forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result as string;
            if (result) setImages(prev => [...prev, result]);
          };
          reader.readAsDataURL(file);
        });
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
        fileArray.forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result as string;
            if (result) setAttachments(prev => [...prev, result]);
          };
          reader.readAsDataURL(file);
        });
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

            <div className="space-y-2">
              <Label>Изображения</Label>
              <div className="space-y-2">
                {images.map((image, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Image src={image} alt={`Изображение ${index + 1}`} width={64} height={64} className="w-16 h-16 object-cover rounded-md" />
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
                {attachments.map((_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {getFileIcon(`file_${index + 1}`)}
                    <span className="flex-1 text-sm truncate">Файл {index + 1}</span>
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
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{saveStatus}</span>
                  <span className="font-medium">{saveProgress}%</span>
                </div>
                <Progress value={saveProgress} className="w-full" />
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSaving}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSaving || updateProject.isPending} className="flex-1">
                {isSaving || updateProject.isPending ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </form>
        )}
      </CustomDialogContent>
    </Dialog>
  );
}


