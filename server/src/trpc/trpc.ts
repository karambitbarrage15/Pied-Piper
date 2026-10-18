import { initTRPC } from "@trpc/server";
import { type Context } from "./context.js";
import { logger } from "../utils/logger.js";

const t = initTRPC.context<Context>().create();

// Middleware for logging tRPC procedure calls and execution time
const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (result.ok) {
    logger.debug(`[tRPC] ${type} '${path}' completed in ${durationMs}ms`);
  } else {
    logger.error({ err: result.error }, `[tRPC] ${type} '${path}' failed in ${durationMs}ms`);
  }

  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware);
