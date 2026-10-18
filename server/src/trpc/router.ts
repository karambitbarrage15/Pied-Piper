import { router, publicProcedure } from "./trpc.js";
import { ALGORITHM_INFO, ALGORITHMS } from "@pied-piper/shared";

export const appRouter = router({
  health: publicProcedure.query(() => {
    const memory = process.memoryUsage();
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
      },
    };
  }),

  algorithms: router({
    list: publicProcedure.query(() => {
      return {
        algorithms: ALGORITHMS.map((id) => ALGORITHM_INFO[id]),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
