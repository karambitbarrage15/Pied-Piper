import path from "node:path";
import { Queue, Worker, type Job } from "bullmq";
import type Redis from "ioredis";
import {
  type CompressionJob,
  type Algorithm,
  type CompleteEvent,
  type ProgressEvent,
} from "@pied-piper/shared";
import { env } from "../config/env.js";
import { CompressionService } from "../services/compression.service.js";
import {
  type TypedSocketServer,
  emitJobProgress,
  emitJobComplete,
  emitJobError,
} from "../socket/handler.js";
import { logger } from "../utils/logger.js";

export interface JobData {
  jobId: string;
  fileId: string;
  fileName: string;
  inputPath: string;
  originalSize: number;
  algorithm: Algorithm;
  level: number;
}

// In-memory job repository for fast status lookups and fallback queue
const jobStore = new Map<string, CompressionJob>();

// Recent jobs list (ordered by createdAt descending)
const jobHistory: string[] = [];

export class JobManager {
  private static bullQueue: Queue<JobData> | null = null;
  private static bullWorker: Worker<JobData> | null = null;
  private static io: TypedSocketServer | null = null;
  private static redis: Redis | null = null;
  private static isRedisReady: boolean = false;

  // In-memory fallback queue for running without Redis
  private static fallbackQueue: JobData[] = [];
  private static activeJobsCount: number = 0;

  static initialize(io: TypedSocketServer, redis: Redis): void {
    this.io = io;
    this.redis = redis;

    // Monitor Redis connection state
    redis.on("connect", () => {
      this.isRedisReady = true;
      this.initBullMQ();
    });

    redis.on("error", () => {
      this.isRedisReady = false;
    });

    // Check if redis was already connected
    if (redis.status === "ready" || redis.status === "connect") {
      this.isRedisReady = true;
      this.initBullMQ();
    }
  }

  private static initBullMQ(): void {
    if (this.bullQueue || !this.redis) return;

    try {
      this.bullQueue = new Queue<JobData>("compression-queue", {
        connection: this.redis,
      });

      this.bullWorker = new Worker<JobData>(
        "compression-queue",
        async (job: Job<JobData>) => {
          await this.executeCompression(job.data);
        },
        {
          connection: this.redis,
          concurrency: env.MAX_CONCURRENT_COMPRESSIONS,
        }
      );

      this.bullWorker.on("completed", (job) => {
        logger.info(`BullMQ job ${job.id} completed.`);
      });

      this.bullWorker.on("failed", (job, err) => {
        logger.error({ err }, `BullMQ job ${job?.id} failed.`);
      });

      logger.info("⚡ BullMQ compression queue and worker initialized with Redis.");
    } catch (e) {
      logger.warn({ err: e }, "Could not initialize BullMQ, continuing with in-memory runner");
    }
  }

  /**
   * Create and enqueue a compression job
   */
  static async createJob(params: {
    jobId: string;
    fileId: string;
    fileName: string;
    inputPath: string;
    originalSize: number;
    algorithm: Algorithm;
    level: number;
  }): Promise<CompressionJob> {
    const jobRecord: CompressionJob = {
      jobId: params.jobId,
      fileId: params.fileId,
      fileName: params.fileName,
      originalSize: params.originalSize,
      compressedSize: null,
      algorithm: params.algorithm,
      level: params.level,
      status: "queued",
      progress: 0,
      speed: 0,
      eta: 0,
      compressionRatio: null,
      weissmanScore: null,
      timeTaken: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    jobStore.set(params.jobId, jobRecord);
    jobHistory.unshift(params.jobId);
    if (jobHistory.length > 50) jobHistory.pop();

    const jobData: JobData = { ...params };

    if (this.isRedisReady && this.bullQueue) {
      try {
        await this.bullQueue.add(`job-${params.jobId}`, jobData, {
          jobId: params.jobId,
          removeOnComplete: 100,
          removeOnFail: 100,
        });
        logger.info(`Job ${params.jobId} submitted to BullMQ queue`);
        return jobRecord;
      } catch (err) {
        logger.warn({ err }, "BullMQ submission failed, using local in-memory queue fallback");
      }
    }

    // Fallback: in-memory queue
    this.fallbackQueue.push(jobData);
    logger.info(`Job ${params.jobId} enqueued in local memory runner`);
    this.processNextFallbackJob();

    return jobRecord;
  }

  private static processNextFallbackJob(): void {
    if (this.activeJobsCount >= env.MAX_CONCURRENT_COMPRESSIONS) {
      return;
    }

    const nextJob = this.fallbackQueue.shift();
    if (!nextJob) return;

    this.activeJobsCount++;
    this.executeCompression(nextJob)
      .catch((err) => {
        logger.error({ err }, `Error executing local job ${nextJob.jobId}`);
      })
      .finally(() => {
        this.activeJobsCount--;
        this.processNextFallbackJob();
      });
  }

  /**
   * Execute actual streaming compression for a job
   */
  private static async executeCompression(data: JobData): Promise<void> {
    const job = jobStore.get(data.jobId);
    if (!job) return;

    job.status = "processing";

    const ext = CompressionService.getExtensionForAlgorithm(data.algorithm);
    const outputFileName = `${data.fileId}_${path.parse(data.fileName).name}${ext}`;
    const outputPath = path.resolve(env.OUTPUT_DIR, outputFileName);

    try {
      const result = await CompressionService.compressFile({
        jobId: data.jobId,
        inputPath: data.inputPath,
        outputPath,
        algorithm: data.algorithm,
        level: data.level,
        originalSize: data.originalSize,
        onProgress: (progress: ProgressEvent) => {
          job.progress = progress.percent;
          job.speed = progress.speed;
          job.eta = progress.eta;
          job.compressionRatio = progress.compressionRatio;
          job.compressedSize = progress.compressedSize;

          if (this.io) {
            emitJobProgress(this.io, progress);
          }
        },
      });

      job.status = "completed";
      job.progress = 100;
      job.compressedSize = result.compressedSize;
      job.compressionRatio = result.compressionRatio;
      job.weissmanScore = result.weissmanScore;
      job.timeTaken = result.timeTakenMs;
      job.completedAt = new Date().toISOString();

      const downloadUrl = `/api/download/${data.jobId}`;

      const completeEvent: CompleteEvent = {
        jobId: data.jobId,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: result.compressionRatio,
        weissmanScore: result.weissmanScore,
        timeTaken: result.timeTakenMs,
        downloadUrl,
      };

      if (this.io) {
        emitJobComplete(this.io, completeEvent);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Compression failed";
      job.status = "failed";
      job.error = errorMessage;

      if (this.io) {
        emitJobError(this.io, {
          jobId: data.jobId,
          message: errorMessage,
        });
      }
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  static getJob(jobId: string): CompressionJob | null {
    return jobStore.get(jobId) || null;
  }

  /**
   * Get recent jobs
   */
  static getRecentJobs(limit: number = 10): CompressionJob[] {
    return jobHistory
      .slice(0, limit)
      .map((id) => jobStore.get(id))
      .filter((j): j is CompressionJob => j !== undefined);
  }

  /**
   * Cancel a running or queued job
   */
  static cancelJob(jobId: string): boolean {
    const job = jobStore.get(jobId);
    if (!job) return false;

    if (job.status === "queued" || job.status === "processing") {
      job.status = "cancelled";
      // Remove from fallback queue if present
      this.fallbackQueue = this.fallbackQueue.filter((j) => j.jobId !== jobId);
      return true;
    }
    return false;
  }

  /**
   * Get output file path for a completed job
   */
  static getOutputFile(jobId: string): { filePath: string; fileName: string } | null {
    const job = jobStore.get(jobId);
    if (!job || job.status !== "completed") return null;

    const ext = CompressionService.getExtensionForAlgorithm(job.algorithm);
    const parsedName = path.parse(job.fileName).name;
    const outputFileName = `${job.fileId}_${parsedName}${ext}`;
    const filePath = path.resolve(env.OUTPUT_DIR, outputFileName);
    const downloadFileName = `${parsedName}${ext}`;

    return { filePath, fileName: downloadFileName };
  }
}
