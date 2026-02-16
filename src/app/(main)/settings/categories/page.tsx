"use client";

import { api } from "~/trpc/react";
import Loader from "~/components/ui/loader";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";

export default function CategoriesSettingsPage() {
  const { data: user, isLoading: isLoadingUser } = api.tg.getUser.useQuery();
  const { data: categories, isLoading: isLoadingCategories, refetch } = api.categories.getAll.useQuery();
  const utils = api.useUtils();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "",
    backgroundImage: "",
  });

  const createCategory = api.categories.create.useMutation({
    onSuccess: async () => {
      await utils.categories.getAll.invalidate();
      await utils.projects.categories.invalidate();
      setIsCreateModalOpen(false);
      resetForm();
      await refetch();
    },
  });

  const updateCategory = api.categories.update.useMutation({
    onSuccess: async () => {
      await utils.categories.getAll.invalidate();
      await utils.projects.categories.invalidate();
      setEditingCategory(null);
      resetForm();
      await refetch();
    },
  });

  const deleteCategory = api.categories.delete.useMutation({
    onSuccess: async () => {
      await utils.categories.getAll.invalidate();
      await utils.projects.categories.invalidate();
      await refetch();
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon: "",
      color: "",
      backgroundImage: "",
    });
  };

  const handleEdit = (category: NonNullable<typeof categories>[0]) => {
    setEditingCategory(category.id);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      icon: category.icon ?? "",
      color: category.color ?? "",
      backgroundImage: category.backgroundImage ?? "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.slug.trim()) {
      alert("Название и slug обязательны");
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory,
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          color: formData.color || undefined,
          backgroundImage: formData.backgroundImage || undefined,
        });
      } else {
        await createCategory.mutateAsync({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          color: formData.color || undefined,
          backgroundImage: formData.backgroundImage || undefined,
        });
      }
    } catch (error) {
      console.error("Ошибка сохранения категории:", error);
      alert(error instanceof Error ? error.message : "Ошибка сохранения категории");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить эту категорию? Все проекты в этой категории также будут удалены.")) {
      return;
    }

    try {
      await deleteCategory.mutateAsync({ id });
    } catch (error) {
      console.error("Ошибка удаления категории:", error);
      alert(error instanceof Error ? error.message : "Ошибка удаления категории");
    }
  };

  if (isLoadingUser || isLoadingCategories) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="space-y-4 pb-52">
        <h1 className="text-2xl font-bold">Доступ запрещен</h1>
        <p className="text-muted-foreground">У вас нет прав для доступа к этой странице.</p>
        <Link href="/settings">
          <Button variant="outline">
            Вернуться в настройки
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-52">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Управление категориями</h1>
          <p className="text-muted-foreground">
            Создавайте, редактируйте и удаляйте категории проектов
          </p>
        </div>
        <Button onClick={() => {
          resetForm();
          setEditingCategory(null);
          setIsCreateModalOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить категорию
        </Button>
      </div>

      {categories && categories.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {category.icon && <span>{category.icon}</span>}
                      {category.name}
                    </CardTitle>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Slug:</span>{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{category.slug}</code>
                  </div>
                  {category.color && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Цвет:</span>
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: category.color }}
                      />
                      <code className="text-xs">{category.color}</code>
                    </div>
                  )}
                  {category.backgroundImage && (
                    <div>
                      <span className="text-muted-foreground">Фон:</span>{" "}
                      <span className="text-xs">✓ Установлен</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(category)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Редактировать
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Категории не найдены. Создайте первую категорию.
          </CardContent>
        </Card>
      )}

      {/* Модальное окно создания/редактирования */}
      <Dialog open={isCreateModalOpen || editingCategory !== null} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setEditingCategory(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Редактировать категорию" : "Создать категорию"}
            </DialogTitle>
            <DialogDescription>
              Заполните информацию о категории. Категории отображаются на главной странице и используются при создании проектов.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Недвижимость"
                required
              />
            </div>

            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                placeholder="Например: real-estate"
                required
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Только строчные буквы, цифры и дефисы
              </p>
            </div>

            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Краткое описание категории"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="icon">Иконка (эмодзи)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="Например: 🏠"
                maxLength={10}
              />
            </div>

            <div>
              <Label htmlFor="color">Цвет (HEX)</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color || "#000000"}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#000000"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="backgroundImage">URL фонового изображения</Label>
              <Input
                id="backgroundImage"
                type="url"
                value={formData.backgroundImage}
                onChange={(e) => setFormData({ ...formData, backgroundImage: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Изображение будет использоваться как фон на главной странице
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingCategory(null);
                  resetForm();
                }}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createCategory.isPending || updateCategory.isPending}
              >
                {createCategory.isPending || updateCategory.isPending
                  ? "Сохранение..."
                  : editingCategory
                  ? "Сохранить"
                  : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
