// Server entry point — placeholder for Phase 2
// Will wire up Express + tRPC + Socket.io here

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

logger.info("🎵 Pied Piper Compression Server");
logger.info(`   Environment: ${env.NODE_ENV}`);
logger.info(`   Port: ${env.PORT}`);
logger.info(`   Redis: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
logger.info(`   Default Algorithm: ${env.DEFAULT_ALGORITHM} (level ${env.DEFAULT_COMPRESSION_LEVEL})`);
logger.info(`   Max file size: ${env.MAX_FILE_SIZE_GB} GB`);
logger.info("");
logger.info("📦 Phase 1 complete — project scaffold ready!");
logger.info("🔜 Phase 2 will add Express + tRPC + Socket.io server");
