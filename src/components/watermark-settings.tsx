"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, RotateCcw, Upload, X, Image as ImageIcon } from "lucide-react";
import { uploadFile } from "~/lib/upload";

export default function WatermarkSettings() {
  const { data: settings, isLoading } = api.settings.getWatermarkSettings.useQuery();
  const utils = api.useUtils();
  const updateSettings = api.settings.updateWatermarkSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки водяного знака сохранены");
      void utils.settings.getWatermarkSettings.invalidate();
    },
    onError: (error) => {
      toast.error(`Ошибка при сохранении: ${error.message}`);
    },
  });

  const uploadWatermarkImage = api.settings.uploadWatermarkImage.useMutation({
    onSuccess: () => {
      toast.success("Изображение водяного знака загружено");
      void utils.settings.getWatermarkSettings.invalidate();
    },
    onError: (error) => {
      toast.error(`Ошибка при загрузке изображения: ${error.message}`);
    },
  });

  const [formData, setFormData] = useState<{
    enabled: boolean;
    text: string;
    opacity: number;
    fontSize: number;
    color: { r: number; g: number; b: number };
    angle: number;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'repeat';
    useImage: boolean;
    watermarkImageKey?: string;
  }>({
    enabled: true,
    text: 'Matigroup',
    opacity: 0.15,
    fontSize: 48,
    color: { r: 0, g: 0, b: 0 },
    angle: -45,
    position: 'center',
    useImage: false,
  });

  const [watermarkImagePreview, setWatermarkImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled ?? true,
        text: settings.text ?? 'Matigroup',
        opacity: settings.opacity ?? 0.15,
        fontSize: settings.fontSize ?? 48,
        color: settings.color ?? { r: 0, g: 0, b: 0 },
        angle: settings.angle ?? -45,
        position: (settings.position as 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'repeat') ?? 'center',
        useImage: settings.useImage ?? false,
        watermarkImageKey: settings.watermarkImageKey,
      });
      
      // Загружаем превью изображения водяного знака, если оно есть
      if (settings.watermarkImageKey) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        setWatermarkImagePreview(`${baseUrl}/api/images/${settings.watermarkImageKey}`);
      } else {
        setWatermarkImagePreview(null);
      }
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate(formData);
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        enabled: settings.enabled ?? true,
        text: settings.text ?? 'Matigroup',
        opacity: settings.opacity ?? 0.15,
        fontSize: settings.fontSize ?? 48,
        color: settings.color ?? { r: 0, g: 0, b: 0 },
        angle: settings.angle ?? -45,
        position: settings.position ?? 'center',
        useImage: settings.useImage ?? false,
        watermarkImageKey: settings.watermarkImageKey,
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем, что это изображение
    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    try {
      // Загружаем изображение через специальный API endpoint для водяного знака
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "image");
      formData.append("variant", "original");
      formData.append("isWatermark", "true");

      const initData =
        typeof window !== "undefined"
          ? window.Telegram?.WebApp?.initData ?? ""
          : "";

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-telegram-init-data": initData,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Ошибка загрузки изображения");
      }

      const result = await response.json();

      // Сохраняем ключ изображения в настройках
      uploadWatermarkImage.mutate({ imageKey: result.key });
      
      // Показываем превью
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      setWatermarkImagePreview(`${baseUrl}/api/images/${result.key}`);
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error);
      toast.error('Не удалось загрузить изображение');
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, useImage: false, watermarkImageKey: undefined });
    setWatermarkImagePreview(null);
    // Обновляем настройки, чтобы убрать изображение
    updateSettings.mutate({
      ...formData,
      useImage: false,
      watermarkImageKey: undefined,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Настройки водяного знака</CardTitle>
          <CardDescription>Загрузка...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки водяного знака</CardTitle>
        <CardDescription>
          Настройте параметры водяного знака, который будет автоматически добавляться к загружаемым изображениям
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Включить/выключить */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Включить водяной знак</Label>
              <p className="text-sm text-muted-foreground">
                Автоматически добавлять водяной знак к загружаемым изображениям
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, enabled: checked })
              }
            />
          </div>

          {formData.enabled && (
            <>
              {/* Выбор типа водяного знака */}
              <div className="space-y-2">
                <Label>Тип водяного знака</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="watermarkType"
                      checked={!formData.useImage}
                      onChange={() => setFormData({ ...formData, useImage: false })}
                      className="w-4 h-4"
                    />
                    <span>Текст</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="watermarkType"
                      checked={formData.useImage}
                      onChange={() => setFormData({ ...formData, useImage: true })}
                      className="w-4 h-4"
                    />
                    <span>Изображение</span>
                  </label>
                </div>
              </div>

              {formData.useImage ? (
                /* Загрузка изображения водяного знака */
                <div className="space-y-2">
                  <Label>Изображение водяного знака</Label>
                  {watermarkImagePreview ? (
                    <div className="relative">
                      <img
                        src={watermarkImagePreview}
                        alt="Водяной знак"
                        className="w-full max-w-xs h-auto rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="watermark-image-upload"
                        disabled={uploadWatermarkImage.isPending}
                      />
                      <label
                        htmlFor="watermark-image-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {uploadWatermarkImage.isPending ? 'Загрузка...' : 'Нажмите для загрузки изображения'}
                        </span>
                      </label>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Загрузите изображение для использования в качестве водяного знака. При замене старое изображение будет перезаписано.
                  </p>
                </div>
              ) : (
                /* Текст водяного знака */
                <div className="space-y-2">
                  <Label htmlFor="text">Текст водяного знака</Label>
                  <Input
                    id="text"
                    value={formData.text}
                    onChange={(e) =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                    placeholder="Matigroup"
                    maxLength={100}
                  />
                  <p className="text-sm text-muted-foreground">
                    Максимум 100 символов
                  </p>
                </div>
              )}

              {/* Прозрачность */}
              <div className="space-y-2">
                <Label htmlFor="opacity">
                  Прозрачность: {Math.round(formData.opacity * 100)}%
                </Label>
                <Input
                  id="opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formData.opacity}
                  onChange={(e) =>
                    setFormData({ ...formData, opacity: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  От 0 (полностью прозрачный) до 1 (полностью непрозрачный)
                </p>
              </div>

              {/* Размер шрифта */}
              <div className="space-y-2">
                <Label htmlFor="fontSize">Размер шрифта: {formData.fontSize}px</Label>
                <Input
                  id="fontSize"
                  type="range"
                  min="10"
                  max="200"
                  step="1"
                  value={formData.fontSize}
                  onChange={(e) =>
                    setFormData({ ...formData, fontSize: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  От 10 до 200 пикселей
                </p>
              </div>

              {/* Цвет */}
              <div className="space-y-4">
                <Label>Цвет водяного знака</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="colorR" className="text-sm">
                      Красный (R): {formData.color.r}
                    </Label>
                    <Input
                      id="colorR"
                      type="range"
                      min="0"
                      max="255"
                      step="1"
                      value={formData.color.r}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          color: { ...formData.color, r: parseInt(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="colorG" className="text-sm">
                      Зеленый (G): {formData.color.g}
                    </Label>
                    <Input
                      id="colorG"
                      type="range"
                      min="0"
                      max="255"
                      step="1"
                      value={formData.color.g}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          color: { ...formData.color, g: parseInt(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="colorB" className="text-sm">
                      Синий (B): {formData.color.b}
                    </Label>
                    <Input
                      id="colorB"
                      type="range"
                      min="0"
                      max="255"
                      step="1"
                      value={formData.color.b}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          color: { ...formData.color, b: parseInt(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded border"
                    style={{
                      backgroundColor: `rgb(${formData.color.r}, ${formData.color.g}, ${formData.color.b})`,
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Предпросмотр цвета
                  </p>
                </div>
              </div>

              {/* Угол поворота */}
              <div className="space-y-2">
                <Label htmlFor="angle">
                  Угол поворота: {formData.angle}°
                </Label>
                <Input
                  id="angle"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={formData.angle}
                  onChange={(e) =>
                    setFormData({ ...formData, angle: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  От -180° до 180°
                </p>
              </div>

              {/* Позиция */}
              <div className="space-y-2">
                <Label htmlFor="position">Позиция водяного знака</Label>
                <select
                  id="position"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      position: e.target.value as 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'repeat',
                    })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="center">По центру</option>
                  <option value="top-left">Сверху слева</option>
                  <option value="top-right">Сверху справа</option>
                  <option value="bottom-left">Снизу слева</option>
                  <option value="bottom-right">Снизу справа</option>
                  <option value="repeat">Повторяющийся паттерн</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Выберите расположение водяного знака на изображении
                </p>
              </div>
            </>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettings.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={updateSettings.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Сбросить
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
