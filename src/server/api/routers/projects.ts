import { db } from "~/server/db";
import { createTRPCRouter, procedure } from "../trpc";
import { z } from "zod";
import { categories, projects, users } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

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

      // Оптимизируем данные для списка - убираем большие файлы
      return projectsData.map(project => ({
        ...project,
        images: project.images?.slice(0, 1), // Только первое изображение для превью
        attachments: project.attachments?.length ? ['metadata:files'] : [], // Только метаданные
      }));
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

      // Оптимизируем данные для ограниченных ресурсов сервера
      if (project) {
        // Ограничиваем количество изображений для экономии памяти
        if (project.images && project.images.length > 2) {
          project.images = project.images.slice(0, 2);
        }
        
        // Сжимаем изображения на сервере (упрощенная версия)
        if (project.images && project.images.length > 0) {
          project.images = project.images.map(image => {
            if (typeof image === 'string' && image.startsWith('data:')) {
              // Если изображение слишком большое (>500KB), заменяем на placeholder
              if (image.length > 500 * 1024) {
                return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
              }
            }
            return image;
          });
        }
        
        // Для файлов показываем только метаданные, не сами файлы
        if (project.attachments && project.attachments.length > 0) {
          project.attachments = project.attachments.map((attachment, index) => {
            if (typeof attachment === 'string' && attachment.startsWith('data:')) {
              // Извлекаем только MIME тип и размер для отображения
              const mimeMatch = attachment.match(/data:([^;]+);/);
              const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
              const size = Math.round(attachment.length / 1024); // KB
              return `metadata:${mimeType}:${size}:file_${index + 1}`;
            }
            return attachment;
          });
        }
      }

      return project;
    }),

  // Get full project data (with files) - for admin or when needed
  projectFull: procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      // Только админы могут получить полные данные с файлами
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      return await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: {
          category: true,
          user: true,
        },
      });
    }),

  // Get featured projects
  featured: procedure.query(async () => {
    return await db.query.projects.findMany({
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
  }),

  // Get all projects (for admin)
  allProjects: procedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    return await db.query.projects.findMany({
      with: {
        category: true,
        user: true,
      },
      orderBy: [desc(projects.createdAt)],
    });
  }),

  // Create project (for admin)
  create: procedure
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        content: z.string().optional(),
        images: z.array(z.string()).optional(),
        attachments: z.array(z.string()).optional(),
        categoryId: z.number(),
        status: z.enum(["draft", "published", "archived"]).default("draft"),
        featured: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      return await db.insert(projects).values({
        ...input,
        userId: ctx.user.id,
      });
    }),

  // Update project (for admin)
  update: procedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        images: z.array(z.string()).optional(),
        categoryId: z.number().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        featured: z.boolean().optional(),
      })
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
          projectsData.push(project);
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
