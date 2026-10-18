import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Server as SocketIOServer } from "socket.io";
import type Redis from "ioredis";
import type { ClientToServerEvents, ServerToClientEvents } from "@pied-piper/shared";

export interface ContextOptions {
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  redis: Redis;
}

export interface Context {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  redis: Redis;
}

export function createContextFactory(options: ContextOptions) {
  return ({ req, res }: CreateExpressContextOptions): Context => {
    return {
      req,
      res,
      io: options.io,
      redis: options.redis,
    };
  };
}
