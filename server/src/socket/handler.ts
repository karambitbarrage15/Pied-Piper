import type { Server as SocketIOServer, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ProgressEvent,
  CompleteEvent,
  ErrorEvent,
} from "@pied-piper/shared";
import { logger } from "../utils/logger.js";

export type TypedSocketServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(io: TypedSocketServer): void {
  io.on("connection", (socket: TypedSocket) => {
    logger.info(`🔌 Socket client connected: ${socket.id}`);

    socket.on("subscribe", ({ jobId }) => {
      const room = `job:${jobId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on("unsubscribe", ({ jobId }) => {
      const room = `job:${jobId}`;
      socket.leave(room);
      logger.debug(`Socket ${socket.id} left room ${room}`);
    });

    socket.on("disconnect", (reason) => {
      logger.info(`🔌 Socket client disconnected: ${socket.id} (${reason})`);
    });
  });
}

/**
 * Emit real-time progress update to all clients subscribed to this job
 */
export function emitJobProgress(io: TypedSocketServer, event: ProgressEvent): void {
  io.to(`job:${event.jobId}`).emit("progress", event);
}

/**
 * Emit job completion event with Weissman score and final stats
 */
export function emitJobComplete(io: TypedSocketServer, event: CompleteEvent): void {
  io.to(`job:${event.jobId}`).emit("complete", event);
}

/**
 * Emit job failure event
 */
export function emitJobError(io: TypedSocketServer, event: ErrorEvent): void {
  io.to(`job:${event.jobId}`).emit("error", event);
}
