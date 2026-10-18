import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export function createRedisConnection(name: string = "default"): Redis {
  let hasLoggedOfflineWarning = false;

  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: true, // Don't block startup
    enableOfflineQueue: false,
    retryStrategy: (times: number) => {
      // Exponential backoff, up to 10s between checks
      return Math.min(times * 1000, 10000);
    },
  });

  redis.on("connect", () => {
    hasLoggedOfflineWarning = false;
    logger.info(`✅ Redis [${name}] connected at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
  });

  redis.on("error", (err: Error) => {
    if (!hasLoggedOfflineWarning) {
      hasLoggedOfflineWarning = true;
      logger.warn(
        `⚠️ Redis [${name}] is not currently reachable (${err.message}). ` +
        `Start Redis with 'docker-compose up -d' when ready to process queue jobs.`
      );
    }
  });

  // Attempt non-blocking initial connection in background
  redis.connect().catch(() => {
    // Handled by 'error' listener above
  });

  return redis;
}
