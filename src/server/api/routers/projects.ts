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

      // Оптимизируем данные для списка
      return projectsData.map(project => ({
        ...project,
        images: project.images?.slice(0, 1), // Только первое изображение для превью
        attachments: [], // Без вложений в списке
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
