import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    port: 5173,
    proxy: {
      // Proxy API and upload/download requests to the Express server
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/trpc": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Proxy WebSocket connections to Socket.io
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
