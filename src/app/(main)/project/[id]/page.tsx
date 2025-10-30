"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, User, Download, Eye, FileText, Image, FileVideo, FileAudio, Archive, File, Trash2, X, Pencil } from "lucide-react";
import FavoriteButton from "~/components/favorite-button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import EditProjectModal from "~/components/edit-project-modal";

interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { data: user } = api.tg.getUser.useQuery();
  
  // Состояния для модального окна файла
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<{data: string, name: string, type: string} | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // Используем оптимизированный запрос для быстрой загрузки
  const { data: project, isLoading } = api.projects.project.useQuery({
    id: parseInt(params.id),
  });
  
  // Загружаем полные данные только для админов и только при необходимости
  const { data: projectFull } = api.projects.projectFull.useQuery(
    { id: parseInt(params.id) },
    { 
      enabled: user?.role === "admin",
      refetchOnWindowFocus: false,
    }
  );
  
  const utils = api.useUtils();
  const deleteProject = api.projects.delete.useMutation({
    onSuccess: async () => {
      // Инвалидируем кэш для обновления списков
      await utils.projects.categories.invalidate();
      await utils.projects.featured.invalidate();
      await utils.projects.allProjects.invalidate();
      await utils.projects.favorites.invalidate();
    },
  });
  const router = useRouter();
  
  // Используем полные данные для админов, оптимизированные для остальных
  const displayProject = user?.role === "admin" ? (projectFull || project) : project;

  const handleDeleteProject = async () => {
    if (!displayProject) return;
    
    const confirmed = confirm(
      `Вы уверены, что хотите удалить проект "${displayProject.title}"? Это действие нельзя отменить.`
    );
    
    if (!confirmed) return;
    
    try {
      await deleteProject.mutateAsync({ id: displayProject.id });
      alert('Проект успешно удален!');
      router.push('/');
    } catch (error) {
      console.error('Ошибка удаления проекта:', error);
      alert('Ошибка при удалении проекта');
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return <Image className="h-4 w-4" />;
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension || '')) {
      return <FileVideo className="h-4 w-4" />;
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension || '')) {
      return <FileAudio className="h-4 w-4" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '')) {
      return <Archive className="h-4 w-4" />;
    }
    if (['pdf'].includes(extension || '')) {
      return <FileText className="h-4 w-4" />;
    }
    
    return <File className="h-4 w-4" />;
  };

  const downloadFile = (fileData: string, fileName: string, withWatermark: boolean = false) => {
    try {
      console.log('Начинаем скачивание файла:', { fileName, hasData: fileData.length > 0, withWatermark });
      
      // Проверяем, что данные не пустые
      if (!fileData || fileData.length === 0) {
        throw new Error('Файл пустой или не найден');
      }
      
      // Если это base64 данные
      if (fileData.startsWith('data:')) {
        // Создаем blob из base64
        const base64Data = fileData.split(',')[1];
        if (!base64Data) {
          throw new Error('Некорректные base64 данные');
        }
        
        // Определяем MIME тип
        const mimeMatch = fileData.match(/data:([^;]+);/);
        const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
        
        console.log('MIME тип:', mimeType);
        
        // Конвертируем base64 в blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        console.log('Blob создан:', { size: blob.size, type: blob.type });
        
        // Проверяем размер файла
        if (blob.size === 0) {
          throw new Error('Файл пустой');
        }
        
        // Создаем URL для blob
        const url = URL.createObjectURL(blob);
        
        // Создаем временную ссылку для скачивания
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        // Добавляем в DOM, кликаем и удаляем
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Очищаем URL через некоторое время
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
        
        console.log('Файл отправлен на скачивание');
      } else {
        // Обычная ссылка
        const link = document.createElement('a');
        link.href = fileData;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Ошибка при скачивании файла: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const downloadFileWithWatermark = async (attachmentIndex: number, fileName: string) => {
    try {
      console.log('Начинаем скачивание файла с водяным знаком:', { attachmentIndex, fileName });
      
      const response = await fetch(`/api/files/${params.id}?attachmentIndex=${attachmentIndex}&watermark=true`);
      
      console.log('Ответ сервера:', { 
        status: response.status, 
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка сервера:', errorText);
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Blob получен:', { size: blob.size, type: blob.type });
      
      if (blob.size === 0) {
        throw new Error('Получен пустой файл');
      }
      
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.replace(/\.[^/.]+$/, '_watermarked$&');
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Файл с водяным знаком отправлен на скачивание');
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Ошибка скачивания файла с водяным знаком:', error);
      alert('Ошибка при скачивании файла с водяным знаком: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const openFile = (fileData: string, fileName?: string) => {
    try {
      console.log('Открываем файл в модальном окне:', { hasData: fileData.length > 0 });
      
      // Проверяем, что данные не пустые
      if (!fileData || fileData.length === 0) {
        throw new Error('Файл пустой или не найден');
      }
      
      let fileType = 'application/octet-stream';
      let displayName = fileName || 'Файл';
      
      // Если это base64 данные
      if (fileData.startsWith('data:')) {
        // Определяем MIME тип
        const mimeMatch = fileData.match(/data:([^;]+);/);
        fileType = mimeMatch?.[1] ?? 'application/octet-stream';
        
        console.log('MIME тип для открытия:', fileType);
        
        // Проверяем, можно ли отобразить файл в браузере
        const canDisplayInBrowser = 
          fileType.startsWith('image/') || 
          fileType === 'application/pdf' ||
          fileType.startsWith('text/') ||
          fileType === 'application/json';
        
        if (canDisplayInBrowser) {
          // Устанавливаем данные файла для модального окна
          setCurrentFile({
            data: fileData,
            name: displayName,
            type: fileType
          });
          setIsFileModalOpen(true);
        } else {
          // Для файлов, которые нельзя отобразить в браузере (презентации, архивы и т.д.)
          // автоматически скачиваем их
          console.log('Файл не может быть отображен в браузере, скачиваем:', fileType);
          downloadFile(fileData, displayName);
        }
      } else {
        // Обычная ссылка - открываем в новой вкладке
        window.open(fileData, '_blank');
      }
    } catch (error) {
      console.error('Ошибка открытия файла:', error);
      alert('Ошибка при открытии файла: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Проект не найден</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl mb-4">❌</span>
            <h3 className="text-lg font-semibold mb-2">Проект не найден</h3>
            <p className="text-muted-foreground text-center">
              Запрашиваемый проект не существует или был удален
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!displayProject) {
    return (
      <div className="space-y-6">
        <Link href="/" className="flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Назад к категориям
        </Link>
        <h1 className="text-2xl font-bold">Проект не найден</h1>
        <p className="text-muted-foreground">
          Запрошенный проект не существует или был удален.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 pb-52">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{displayProject.title}</h1>
            {displayProject.featured && (
              <div className="mt-1">
                <Badge variant="default">⭐ Рекомендуемый</Badge>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <FavoriteButton projectId={displayProject.id} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Описание проекта</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {displayProject.description && (
              <p className="text-muted-foreground">{displayProject.description}</p>
            )}
            
            {displayProject.content && (
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: displayProject.content }} />
              </div>
            )}

            {displayProject.images && displayProject.images.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Изображения</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {displayProject.images.map((image: string, index: number) => (
                    <div key={index} className="aspect-video overflow-hidden rounded-md">
                      <img
                        src={image}
                        alt={`${displayProject.title} - изображение ${index + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          // Если изображение не загрузилось, показываем placeholder
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {displayProject.attachments && displayProject.attachments.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Вложения</h3>
                <div className="space-y-2">
                  {displayProject.attachments.map((attachment: string, index: number) => {
                    // Пытаемся извлечь информацию о файле из base64
                    let fileName = `attachment_${index + 1}`;
                    let fileIcon = <File className="h-4 w-4" />;
                    let mimeType = '';
                    
                    // Если это base64 с MIME типом, пытаемся извлечь информацию
                    if (attachment.startsWith('data:')) {
                      const mimeMatch = attachment.match(/data:([^;]+);/);
                      if (mimeMatch?.[1]) {
                        mimeType = mimeMatch[1];
                        if (mimeType.startsWith('image/')) {
                          const extension = mimeType.split('/')[1];
                          fileName = `image_${index + 1}.${extension || 'jpg'}`;
                          fileIcon = <Image className="h-4 w-4" />;
                        } else if (mimeType === 'application/pdf') {
                          fileName = `document_${index + 1}.pdf`;
                          fileIcon = <FileText className="h-4 w-4" />;
                        } else if (mimeType.startsWith('video/')) {
                          const extension = mimeType.split('/')[1];
                          fileName = `video_${index + 1}.${extension || 'mp4'}`;
                          fileIcon = <FileVideo className="h-4 w-4" />;
                        } else if (mimeType.startsWith('audio/')) {
                          const extension = mimeType.split('/')[1];
                          fileName = `audio_${index + 1}.${extension || 'mp3'}`;
                          fileIcon = <FileAudio className="h-4 w-4" />;
                        } else if (mimeType.startsWith('text/')) {
                          const extension = mimeType.split('/')[1];
                          fileName = `text_${index + 1}.${extension || 'txt'}`;
                          fileIcon = <FileText className="h-4 w-4" />;
                        } else if (mimeType.includes('zip') || mimeType.includes('rar')) {
                          fileName = `archive_${index + 1}.zip`;
                          fileIcon = <Archive className="h-4 w-4" />;
                        }
                      }
                    }
                    
                         return (
                           <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                             <div className="flex items-center gap-3 flex-1 min-w-0">
                               {fileIcon}
                               <div className="flex-1 min-w-0">
                                 <span className="font-medium block truncate" title={fileName}>{fileName}</span>
                                 <div className="text-xs text-muted-foreground truncate">
                                   {mimeType && `Тип: ${mimeType}`}
                                   {attachment.length > 0 && ` • Размер: ${Math.round(attachment.length / 1024)} KB`}
                                   {attachment.length === 0 && ` • ⚠️ Файл пустой`}
                                 </div>
                               </div>
                             </div>
                             <div className="flex gap-2">
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => {
                                   console.log('Открытие файла:', { fileName, mimeType, hasData: attachment.length > 0 });
                                   openFile(attachment);
                                 }}
                                 disabled={attachment.length === 0}
                                 title="Открыть файл (для презентаций и архивов - скачать)"
                               >
                                 <Eye className="h-4 w-4 mr-1" />
                                 Открыть
                               </Button>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => {
                                   console.log('Скачивание файла:', { fileName, mimeType, hasData: attachment.length > 0 });
                                   downloadFile(attachment, fileName);
                                 }}
                                 disabled={attachment.length === 0}
                               >
                                 <Download className="h-4 w-4 mr-1" />
                                 Скачать
                               </Button>
                               <Button
                                 variant="outline"
                                 size="sm"
                                onClick={() => {
                                   console.log('Скачивание файла с водяным знаком:', { fileName, index });
                                  void downloadFileWithWatermark(index, fileName);
                                 }}
                                 disabled={attachment.length === 0}
                                 className="bg-gray-50 hover:bg-gray-100"
                                 title="Скачать файл с водяным знаком '123' (очень прозрачный, почти незаметный)"
                               >
                                 <Download className="h-4 w-4 mr-1" />
                                 С водяным знаком
                               </Button>
                             </div>
                           </div>
                         );
                  })}
                </div>
              </div>
            )}

            {/* Кнопки управления (внизу под описанием) */}
            {user?.role === "admin" && (
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                  title="Редактировать проект"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Редактировать
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteProject}
                  disabled={deleteProject.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteProject.isPending ? "Удаление..." : "Удалить"}
                </Button>
                <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(displayProject.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Модальное окно для просмотра файла */}
      <Dialog open={isFileModalOpen} onOpenChange={setIsFileModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFileModalOpen(false)}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>{currentFile?.name || 'Просмотр файла'}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFileModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {currentFile && (
              <div className="space-y-4">
                {/* Информация о файле */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Тип: {currentFile.type}</span>
                  <span>•</span>
                  <span>Размер: {Math.round(currentFile.data.length / 1024)} KB</span>
                </div>
                
                {/* Отображение файла в зависимости от типа */}
                {currentFile.type.startsWith('image/') ? (
                  <div className="flex justify-center">
                    <img
                      src={currentFile.data}
                      alt={currentFile.name}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg"
                    />
                  </div>
                ) : currentFile.type === 'application/pdf' ? (
                  <div className="w-full h-[60vh]">
                    <iframe
                      src={currentFile.data}
                      className="w-full h-full border rounded-lg"
                      title={currentFile.name}
                    />
                  </div>
                ) : currentFile.type.startsWith('text/') ? (
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-[60vh]">
                      {currentFile.data.startsWith('data:') 
                        ? atob(currentFile.data.split(',')[1] || '')
                        : currentFile.data
                      }
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <File className="h-16 w-16 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-lg font-medium">Файл не может быть предварительно просмотрен</p>
                      <p className="text-muted-foreground">
                        Используйте кнопку &quot;Скачать&quot; для загрузки файла
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (currentFile) {
                          downloadFile(currentFile.data, currentFile.name);
                        }
                      }}
                      className="mt-4"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Скачать файл
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      
      {user?.role === "admin" && (
        <EditProjectModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          project={{
            id: displayProject.id,
            title: displayProject.title,
            description: displayProject.description,
            content: displayProject.content,
            categoryId: displayProject.categoryId,
            images: displayProject.images ?? [],
            attachments: displayProject.attachments ?? [],
            featured: displayProject.featured,
            status: displayProject.status,
          }}
        />
      )}
    </>
  );
}
