import { tgRouter } from "~/server/api/routers/tg";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { shopRouter } from "./routers/shop";
import { projectsRouter } from "./routers/projects";
// tapRouter removed

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  tg: tgRouter,
  shop: shopRouter,
  projects: projectsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
