import { db } from "~/server/db";
import { createTRPCRouter, procedure } from "../trpc";
import { z } from "zod";
import { categories, projects } from "~/server/db/schema";
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

      return await db.query.projects.findMany({
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
    }),

  // Get single project
  project: procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.status, "published")
        ),
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
});
