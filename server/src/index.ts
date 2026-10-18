import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import * as trpcExpress from "@trpc/server/adapters/express";
import type { ClientToServerEvents, ServerToClientEvents } from "@pied-piper/shared";

import { env } from "./config/env.js";
import { createRedisConnection } from "./config/redis.js";
import { appRouter } from "./trpc/router.js";
import { createContextFactory } from "./trpc/context.js";
import { setupSocketHandlers } from "./socket/handler.js";
import { JobManager } from "./queue/compression.queue.js";
import { uploadRouter } from "./routes/upload.js";
import { logger } from "./utils/logger.js";

// Ensure required directories exist
const uploadDir = path.resolve(env.UPLOAD_DIR);
const outputDir = path.resolve(env.OUTPUT_DIR);
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

// Initialize Express app & HTTP Server
const app = express();
const server = http.createServer(app);

// Cross-Origin Resource Sharing
const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Redis connection (lazy / graceful)
const redis = createRedisConnection("main-server");

// Socket.io initialization with type safety
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
});
setupSocketHandlers(io);

// Initialize Queue & Job Manager (with BullMQ + in-memory fallback)
JobManager.initialize(io, redis);

// tRPC express middleware mount
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: createContextFactory({ io, redis }),
  })
);

// Upload REST API
app.use("/api/upload", uploadRouter);

// REST Health Check Endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Pied Piper Compression Service",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Start listening
server.listen(env.PORT, () => {
  logger.info(`🚀 Pied Piper server listening on http://localhost:${env.PORT}`);
  logger.info(`⚡ tRPC endpoint mounted at http://localhost:${env.PORT}/trpc`);
  logger.info(`🔌 Socket.io ready on ws://localhost:${env.PORT}`);
  logger.info(`📁 Upload dir: ${uploadDir}`);
  logger.info(`📁 Output dir: ${outputDir}`);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  io.close(() => {
    logger.info("Socket.io connections closed.");
  });

  server.close(async () => {
    logger.info("HTTP server closed.");
    try {
      await redis.quit();
      logger.info("Redis connection closed.");
    } catch (e) {
      logger.warn({ err: e }, "Error while quitting Redis");
    }
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { app, server, io, redis };
