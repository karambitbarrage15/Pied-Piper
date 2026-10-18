import fs from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { router, publicProcedure } from "./trpc.js";
import {
  ALGORITHM_INFO,
  ALGORITHMS,
  AlgorithmSchema,
} from "@pied-piper/shared";
import { JobManager } from "../queue/compression.queue.js";
import { env } from "../config/env.js";

const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);

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

  compress: router({
    start: publicProcedure
      .input(
        z.object({
          fileId: z.string().min(1),
          fileName: z.string().min(1),
          algorithm: AlgorithmSchema.default("zstd"),
          level: z.number().int().min(1).max(22).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const sanitizedName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = path.join(UPLOAD_ROOT, `${input.fileId}_${sanitizedName}`);

        if (!fs.existsSync(filePath)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Uploaded file not found on server for fileId ${input.fileId}`,
          });
        }

        const stat = fs.statSync(filePath);
        const jobId = uuidv4();
        const algoConfig = ALGORITHM_INFO[input.algorithm];
        const level = input.level ?? algoConfig.defaultLevel;

        const job = await JobManager.createJob({
          jobId,
          fileId: input.fileId,
          fileName: input.fileName,
          inputPath: filePath,
          originalSize: stat.size,
          algorithm: input.algorithm,
          level,
        });

        return {
          jobId: job.jobId,
          status: job.status,
          algorithm: job.algorithm,
          level: job.level,
          originalSize: job.originalSize,
        };
      }),

    status: publicProcedure
      .input(z.object({ jobId: z.string().min(1) }))
      .query(({ input }) => {
        const job = JobManager.getJob(input.jobId);
        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Job ${input.jobId} not found`,
          });
        }
        return job;
      }),

    cancel: publicProcedure
      .input(z.object({ jobId: z.string().min(1) }))
      .mutation(({ input }) => {
        const cancelled = JobManager.cancelJob(input.jobId);
        return { success: cancelled };
      }),

    history: publicProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(50).default(10),
          })
          .optional()
      )
      .query(({ input }) => {
        const limit = input?.limit ?? 10;
        return {
          jobs: JobManager.getRecentJobs(limit),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
