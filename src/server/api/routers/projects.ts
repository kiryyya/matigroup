import { db } from "~/server/db";
import { createTRPCRouter, procedure } from "../trpc";
import { z } from "zod";
import { categories, projects, users } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { StoredImage } from "~/types/files";

// Вспомогательная функция для парсинга изображений из JSON
function parseImages(images: unknown): StoredImage[] {
  if (Array.isArray(images)) {
    return images as StoredImage[];
  }
  if (!images) {
    return [];
  }
  try {
    if (typeof images === 'string') {
      const parsed = JSON.parse(images) as unknown;
      return Array.isArray(parsed) ? (parsed as StoredImage[]) : [];
    }
    if (typeof images === 'object') {
      return [images as StoredImage];
    }
  } catch (e) {
    console.error("Error parsing images:", e);
  }
  return [];
}

// Функция для преобразования URL изображений в прокси-URL
// Если URL указывает на Selectel напрямую (403 ошибка), преобразуем в прокси
function transformImageUrl(url: string, key: string): string {
  // Если URL уже прокси, возвращаем как есть
  if (url.includes('/api/images/')) {
    return url;
  }
  
  // Если URL указывает на Selectel, преобразуем в прокси
  // Исправлено: добавлены скобки для правильного приоритета операторов
  if (url.includes('s3.ru-7.storage.selcloud.ru') || (url.includes('s3.') && url.includes('.storage.selcloud.ru'))) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://matigroup-test-bot.ru';
    return `${baseUrl}/api/images/${key}`;
  }
  
  // Также проверяем другие возможные форматы URL Selectel
  if (url.includes('storage.selcloud.ru')) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://matigroup-test-bot.ru';
    return `${baseUrl}/api/images/${key}`;
  }
  
  // Иначе возвращаем оригинальный URL
  return url;
}

// Функция для преобразования массива изображений
function transformImages(images: StoredImage[]): StoredImage[] {
  return images.map(img => {
    // Преобразуем основной URL
    const transformedUrl = transformImageUrl(img.url, img.key);
    
    // Преобразуем previewUrl, если он есть
    // Если previewUrl указывает на Selectel, преобразуем его
    // Если preview не найден, API endpoint автоматически вернет original
    let transformedPreviewUrl: string | undefined = undefined;
    if (img.previewUrl) {
      // Пытаемся найти ключ для preview из previewUrl или формируем из основного ключа
      let previewKey = img.key;
      if (img.key.includes('-original-')) {
        previewKey = img.key.replace('-original-', '-preview-');
      } else if (img.key.includes('original')) {
        previewKey = img.key.replace('original', 'preview');
      } else {
        // Если не нашли, пытаемся извлечь из previewUrl
        const urlMatch = img.previewUrl.match(/images\/([^\/\?]+)/);
        if (urlMatch) {
          previewKey = `images/${urlMatch[1]}`;
        }
      }
      transformedPreviewUrl = transformImageUrl(img.previewUrl, previewKey);
    } else {
      // Если previewUrl нет, используем основной URL как fallback
      transformedPreviewUrl = transformedUrl;
    }
    
    return {
      ...img,
      url: transformedUrl,
      previewUrl: transformedPreviewUrl,
    };
  });
}

export const projectsRouter = createTRPCRouter({
  // Get all categories
  categories: procedure.query(async () => {
    return await db.query.categories.findMany({
      orderBy: [desc(categories.createdAt)],
    });
  }),

  // Get projects by category
  projectsByCategory: procedure
    .input(z.object({ categorySlug: z.string() }))
    .query(async ({ input }) => {
      const category = await db.query.categories.findFirst({
        where: eq(categories.slug, input.categorySlug),
      });

      if (!category) {
        return [];
      }

      const projectsData = await db.query.projects.findMany({
        where: and(
          eq(projects.categoryId, category.id),
          eq(projects.status, "published")
        ),
        with: {
          category: true,
          user: true,
        },
        orderBy: [desc(projects.createdAt)],
      });

      // Оптимизируем данные для списка
      return projectsData.map(project => {
        const imagesArray = parseImages(project.images);
        const transformedImages = transformImages(imagesArray);
        
        // Для списка возвращаем только первое изображение
        // Если есть previewUrl, используем его, иначе url
        const firstImage = transformedImages.length > 0 ? transformedImages[0] : null;
        const listImage = firstImage ? {
          ...firstImage,
          // В списке всегда используем previewUrl если есть, иначе url
          url: firstImage.previewUrl ?? firstImage.url,
        } : null;
        
        return {
          ...project,
          images: listImage ? [listImage] : [], // Только первое изображение для превью
          attachments: [], // Без вложений в списке
        };
      });
    }),

  // Get single project
  project: procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.status, "published")
        ),
        with: {
          category: true,
          user: true,
        },
      });

      if (!project) {
        return null;
      }

      const imagesArray = parseImages(project.images);
      return {
        ...project,
        images: transformImages(imagesArray),
      };
    }),

  // Get full project data (with files) - for admin or when needed
  projectFull: procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      // Только админы могут получить полные данные с файлами
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: {
          category: true,
          user: true,
        },
      });

      if (!project) {
        return null;
      }

      const imagesArray = parseImages(project.images);
      return {
        ...project,
        images: transformImages(imagesArray),
      };
    }),

  // Get featured projects
  featured: procedure.query(async () => {
    const projectsData = await db.query.projects.findMany({
      where: and(
        eq(projects.featured, true),
        eq(projects.status, "published")
      ),
      with: {
        category: true,
        user: true,
      },
      orderBy: [desc(projects.createdAt)],
      limit: 6,
    });

    return projectsData.map(project => {
      const imagesArray = parseImages(project.images);
      return {
        ...project,
        images: transformImages(imagesArray),
      };
    });
  }),

  // Get all projects (for admin)
  allProjects: procedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const projectsData = await db.query.projects.findMany({
      with: {
        category: true,
        user: true,
      },
      orderBy: [desc(projects.createdAt)],
    });

    return projectsData.map(project => {
      const imagesArray = parseImages(project.images);
      return {
        ...project,
        images: transformImages(imagesArray),
      };
    });
  }),

  // Create project (for admin)
  create: procedure
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        content: z.string().optional(),
        images: z
          .array(
            z.object({
              key: z.string(),
              url: z.string().url(),
              previewUrl: z.string().url().optional(),
              size: z.number(),
              mimeType: z.string(),
              width: z.number().optional(),
              height: z.number().optional(),
              originalName: z.string().optional(),
            }),
          )
          .optional(),
        attachments: z
          .array(
            z.object({
              key: z.string(),
              size: z.number(),
              mimeType: z.string(),
              originalName: z.string(),
              kind: z.enum(["document", "archive", "audio", "video", "image", "other"]),
            }),
          )
          .optional(),
        categoryId: z.number(),
        status: z.enum(["draft", "published", "archived"]).default("draft"),
        featured: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      try {
        const result = await db.insert(projects).values({
          ...input,
          userId: ctx.user.id,
        }).returning();
        
        return result[0];
      } catch (error) {
        console.error("Error creating project:", error);
        if (error instanceof Error) {
          throw new Error(`Database error: ${error.message}`);
        }
        throw new Error("Failed to create project");
      }
    }),

  // Update project (for admin)
  update: procedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        images: z
          .array(
            z.object({
              key: z.string(),
              url: z.string().url(),
              previewUrl: z.string().url().optional(),
              size: z.number(),
              mimeType: z.string(),
              width: z.number().optional(),
              height: z.number().optional(),
              originalName: z.string().optional(),
            }),
          )
          .optional(),
        attachments: z
          .array(
            z.object({
              key: z.string(),
              size: z.number(),
              mimeType: z.string(),
              originalName: z.string(),
              kind: z.enum(["document", "archive", "audio", "video", "image", "other"]),
            }),
          )
          .optional(),
        categoryId: z.number().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        featured: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const { id, ...updateData } = input;
      return await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id));
    }),

  // Delete project (for admin)
  delete: procedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      return await db.delete(projects).where(eq(projects.id, input.id));
    }),

  // Favorites API
  // Get user's favorites
  favorites: procedure.query(async ({ ctx }) => {
    try {
      // Get user with favorites
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
        columns: { favorites: true },
      });

      if (!user?.favorites || user.favorites.length === 0) {
        return [];
      }

      // Get projects for each favorite
      const projectsData = [];
      for (const projectId of user.favorites) {
        const project = await db.query.projects.findFirst({
          where: and(
            eq(projects.id, projectId),
            eq(projects.status, "published")
          ),
          with: {
            category: true,
            user: true,
          },
        });
        if (project) {
          const imagesArray = parseImages(project.images);
          projectsData.push({
            ...project,
            images: transformImages(imagesArray),
          });
        }
      }

      return projectsData;
    } catch (error) {
      console.error("Error fetching favorites:", error);
      return [];
    }
  }),

  // Add to favorites
  addToFavorites: procedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get current user favorites
        const user = await db.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
          columns: { favorites: true },
        });

        const currentFavorites = user?.favorites || [];

        // Check if already in favorites
        if (currentFavorites.includes(input.projectId)) {
          return { success: true, message: "Already in favorites" };
        }

        // Add to favorites
        const newFavorites = [...currentFavorites, input.projectId];
        
        await db
          .update(users)
          .set({ favorites: newFavorites })
          .where(eq(users.id, ctx.user.id));

        return { success: true, message: "Added to favorites" };
      } catch (error) {
        console.error("Error adding to favorites:", error);
        throw new Error("Failed to add to favorites");
      }
    }),

  // Remove from favorites
  removeFromFavorites: procedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get current user favorites
        const user = await db.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
          columns: { favorites: true },
        });

        const currentFavorites = user?.favorites || [];

        // Remove from favorites
        const newFavorites = currentFavorites.filter(id => id !== input.projectId);
        
        await db
          .update(users)
          .set({ favorites: newFavorites })
          .where(eq(users.id, ctx.user.id));

        return { success: true, message: "Removed from favorites" };
      } catch (error) {
        console.error("Error removing from favorites:", error);
        throw new Error("Failed to remove from favorites");
      }
    }),

  // Check if project is in favorites
  isFavorite: procedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
          columns: { favorites: true },
        });

        return user?.favorites?.includes(input.projectId) || false;
      } catch (error) {
        console.error("Error checking favorite status:", error);
        return false;
      }
    }),
});
