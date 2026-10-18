import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@pied-piper/shared";

export type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocketClient(): TypedClientSocket {
  const socket: TypedClientSocket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("🔌 Connected to Pied Piper real-time socket server:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.warn("🔌 Disconnected from socket server:", reason);
  });

  return socket;
}
