import { db } from "~/server/db";
import { createTRPCRouter, procedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { categories, projects, users } from "~/server/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import type { StoredImage } from "~/types/files";
import sanitizeHtml from "sanitize-html";
import type {
  CategoryFilterDefinition,
  ProjectFilterValues,
} from "~/types/category-filters";

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
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://matigroup-test-bot.ru";
    return `${baseUrl}/api/images/${key}`;
  }
  
  // Также проверяем другие возможные форматы URL Selectel
  if (url.includes('storage.selcloud.ru')) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://matigroup-test-bot.ru";
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

function sanitizeProjectContent(content?: string | null): string | undefined {
  if (!content) {
    return undefined;
  }

  return sanitizeHtml(content, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "a",
      "img",
      "code",
      "pre",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
  });
}

function normalizeProjectFilterValues(
  rawValues: ProjectFilterValues | undefined,
  categoryFilters: CategoryFilterDefinition[],
) {
  const normalized: ProjectFilterValues = {};
  const categoryFiltersById = new Map(categoryFilters.map((filter) => [filter.id, filter]));

  for (const [filterId, rawValue] of Object.entries(rawValues ?? {})) {
    if (typeof rawValue !== "string") {
      continue;
    }
    const value = rawValue.trim();
    if (!value) {
      continue;
    }

    const definition = categoryFiltersById.get(filterId);
    if (!definition) {
      continue;
    }
    if (!definition.options.includes(value)) {
      continue;
    }
    normalized[filterId] = value;
  }

  return normalized;
}

function validateRequiredCategoryFilters(
  values: ProjectFilterValues,
  categoryFilters: CategoryFilterDefinition[],
) {
  const requiredFilters = categoryFilters.filter((filter) => filter.required);
  if (requiredFilters.length === 0) {
    return;
  }

  const hasSelectedRequired = requiredFilters.some(
    (filter) => values[filter.id] && filter.options.includes(values[filter.id]!),
  );

  if (!hasSelectedRequired) {
    throw new Error("Выберите одно из обязательных значений фильтра категории");
  }
}

const filterValuesSchema = z.record(z.string(), z.string()).optional();

export const projectsRouter = createTRPCRouter({
  // Get all categories
  categories: publicProcedure.query(async () => {
    return await db.query.categories.findMany({
      orderBy: [desc(categories.createdAt)],
    });
  }),

  // Get projects by category with pagination
  projectsByCategory: publicProcedure
    .input(
      z.object({
        categorySlug: z.string(),
        limit: z.number().min(1).max(50).default(10),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const category = await db.query.categories.findFirst({
        where: eq(categories.slug, input.categorySlug),
      });

      if (!category) {
        return {
          items: [],
          nextCursor: undefined,
        };
      }

      const limit = input.limit ?? 10;
      const cursor = input.cursor;

      // Строим условие where с учетом cursor
      const whereConditions = [
        eq(projects.categoryId, category.id),
        eq(projects.status, "published"),
      ];

      // Если есть cursor, добавляем условие для пагинации
      // Используем ID для cursor-based пагинации (ищем проекты с ID меньше cursor)
      if (cursor) {
        whereConditions.push(lt(projects.id, cursor));
      }

      const projectsData = await db.query.projects.findMany({
        where: and(...whereConditions),
        with: {
          category: true,
          user: true,
        },
        orderBy: [desc(projects.createdAt), desc(projects.id)], // Сортируем по дате создания и ID для стабильной пагинации
        limit: limit + 1, // Загружаем на 1 больше, чтобы проверить есть ли еще данные
      });

      // Проверяем, есть ли следующая страница
      let nextCursor: number | undefined = undefined;
      if (projectsData.length > limit) {
        const nextItem = projectsData[limit];
        nextCursor = nextItem?.id;
      }

      // Берем только нужное количество элементов
      const items = projectsData.slice(0, limit);

      // Оптимизируем данные для списка
      const transformedItems = items.map(project => {
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
          content: sanitizeProjectContent(project.content),
          images: listImage ? [listImage] : [], // Только первое изображение для превью
          attachments: [], // Без вложений в списке
        };
      });

      return {
        items: transformedItems,
        nextCursor,
      };
    }),

  // Get single project
  project: publicProcedure
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
        content: sanitizeProjectContent(project.content),
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
        content: sanitizeProjectContent(project.content),
        images: transformImages(imagesArray),
      };
    }),

  // Get featured projects
  featured: publicProcedure.query(async () => {
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
        content: sanitizeProjectContent(project.content),
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
        content: sanitizeProjectContent(project.content),
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
        projectYear: z.number().int().min(1000).max(9999).optional(),
        filterValues: filterValuesSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      try {
        const category = await db.query.categories.findFirst({
          where: eq(categories.id, input.categoryId),
        });
        if (!category) {
          throw new Error("Категория не найдена");
        }

        const normalizedFilterValues = normalizeProjectFilterValues(
          input.filterValues,
          category.filters ?? [],
        );
        validateRequiredCategoryFilters(
          normalizedFilterValues,
          category.filters ?? [],
        );

        const sanitizedInput = {
          ...input,
          content: sanitizeProjectContent(input.content),
          filterValues: normalizedFilterValues,
        };

        const result = await db.insert(projects).values({
          ...sanitizedInput,
          userId: ctx.user.id,
        }).returning();
        
        // Получаем созданный проект с категорией
        const createdProject = await db.query.projects.findFirst({
          where: eq(projects.id, result[0]!.id),
          with: {
            category: true,
          },
        });
        
        const projectResponse = createdProject ?? result[0];
        return {
          ...projectResponse,
          content: sanitizeProjectContent(projectResponse?.content),
        };
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
        projectYear: z.number().int().min(1000).max(9999).optional(),
        filterValues: filterValuesSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const { id, ...updateData } = input;

      const existingProject = await db.query.projects.findFirst({
        where: eq(projects.id, id),
      });
      if (!existingProject) {
        throw new Error("Проект не найден");
      }

      const nextCategoryId = updateData.categoryId ?? existingProject.categoryId;
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, nextCategoryId),
      });
      if (!category) {
        throw new Error("Категория не найдена");
      }

      const baseFilterValues =
        updateData.filterValues ?? existingProject.filterValues ?? {};
      const normalizedFilterValues = normalizeProjectFilterValues(
        baseFilterValues,
        category.filters ?? [],
      );
      validateRequiredCategoryFilters(
        normalizedFilterValues,
        category.filters ?? [],
      );

      const sanitizedUpdateData = {
        ...updateData,
        ...(updateData.content !== undefined
          ? { content: sanitizeProjectContent(updateData.content) }
          : {}),
        filterValues: normalizedFilterValues,
      };
      return await db
        .update(projects)
        .set(sanitizedUpdateData)
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
  // Get user's favorites with pagination
  favorites: procedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        cursor: z.number().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      try {
        const limit = input?.limit ?? 10;
        const cursor = input?.cursor;

        // Get user with favorites
        const user = await db.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
          columns: { favorites: true },
        });

        if (!user?.favorites || user.favorites.length === 0) {
          return {
            items: [],
            nextCursor: undefined,
          };
        }

        // Для favorites используем offset-based пагинацию через cursor
        // cursor - это offset (количество уже загруженных элементов)
        const offset = cursor ?? 0;
        const favoriteIds = user.favorites.slice(offset, offset + limit + 1);
        const hasNextPage = favoriteIds.length > limit;

        // Берем только нужное количество элементов
        const idsToFetch = favoriteIds.slice(0, limit);

        // Get projects for each favorite
        const projectsData = [];
        for (const projectId of idsToFetch) {
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
            const transformedImages = transformImages(imagesArray);
            
            // Для списка избранного возвращаем только первое изображение
            // Если есть previewUrl, используем его, иначе url
            const firstImage = transformedImages.length > 0 ? transformedImages[0] : null;
            const listImage = firstImage ? {
              ...firstImage,
              // В списке всегда используем previewUrl если есть, иначе url
              // Сохраняем оба URL для совместимости с фронтендом
              url: firstImage.previewUrl ?? firstImage.url,
              previewUrl: firstImage.previewUrl ?? firstImage.url,
            } : null;
            
            projectsData.push({
              ...project,
              content: sanitizeProjectContent(project.content),
              images: listImage ? [listImage] : [], // Только первое изображение для превью
              attachments: [], // Без вложений в списке
            });
          }
        }

        // Определяем nextCursor (offset для следующей страницы)
        let nextCursor: number | undefined = undefined;
        if (hasNextPage) {
          nextCursor = offset + limit;
        }

        return {
          items: projectsData,
          nextCursor,
        };
      } catch (error) {
        console.error("Error fetching favorites:", error);
        return {
          items: [],
          nextCursor: undefined,
        };
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

        const currentFavorites = user?.favorites ?? [];

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

        const currentFavorites = user?.favorites ?? [];

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

        return user?.favorites?.includes(input.projectId) ?? false;
      } catch (error) {
        console.error("Error checking favorite status:", error);
        return false;
      }
    }),
});
