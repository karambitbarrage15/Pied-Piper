import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export function createRedisConnection(name: string = "default"): Redis {
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error(`Redis connection [${name}] failed after ${times} retries`);
        return null; // Stop retrying
      }
      return Math.min(times * 200, 5000);
    },
  });

  redis.on("connect", () => {
    logger.info(`Redis [${name}] connected at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
  });

  redis.on("error", (err: Error) => {
    logger.error({ err }, `Redis [${name}] error`);
  });

  return redis;
}
