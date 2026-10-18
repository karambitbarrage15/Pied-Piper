import { z } from "zod";

// ─── Compression Algorithms ────────────────────────────────────────

export const ALGORITHMS = ["zstd", "gzip", "brotli", "deflate"] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

export const AlgorithmSchema = z.enum(ALGORITHMS);

export interface AlgorithmInfo {
  id: Algorithm;
  name: string;
  description: string;
  maxLevel: number;
  defaultLevel: number;
  speedRating: "fast" | "moderate" | "slow";
  ratioRating: "low" | "good" | "high";
}

export const ALGORITHM_INFO: Record<Algorithm, AlgorithmInfo> = {
  zstd: {
    id: "zstd",
    name: "Zstandard",
    description: "Modern standard by Meta — best speed/ratio balance",
    maxLevel: 22,
    defaultLevel: 3,
    speedRating: "fast",
    ratioRating: "high",
  },
  gzip: {
    id: "gzip",
    name: "Gzip",
    description: "Universal compatibility — works everywhere",
    maxLevel: 9,
    defaultLevel: 6,
    speedRating: "moderate",
    ratioRating: "good",
  },
  brotli: {
    id: "brotli",
    name: "Brotli",
    description: "Google's algorithm — best ratio for text content",
    maxLevel: 11,
    defaultLevel: 4,
    speedRating: "slow",
    ratioRating: "high",
  },
  deflate: {
    id: "deflate",
    name: "Deflate",
    description: "Raw compression — lightweight and fast",
    maxLevel: 9,
    defaultLevel: 6,
    speedRating: "fast",
    ratioRating: "good",
  },
};

// ─── Job Types ─────────────────────────────────────────────────────

export const JOB_STATUSES = [
  "queued",
  "uploading",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface CompressionJob {
  jobId: string;
  fileId: string;
  fileName: string;
  originalSize: number;
  compressedSize: number | null;
  algorithm: Algorithm;
  level: number;
  status: JobStatus;
  progress: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  compressionRatio: number | null;
  weissmanScore: number | null;
  timeTaken: number | null; // milliseconds
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

// ─── Upload Types ──────────────────────────────────────────────────

export interface ChunkUploadMeta {
  fileId: string;
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
  totalSize: number;
}

export interface UploadCompletePayload {
  fileId: string;
  fileName: string;
  totalChunks: number;
  totalSize: number;
}

export interface UploadChunkResponse {
  success: boolean;
  chunkIndex: number;
  received: number;
}

export interface UploadCompleteResponse {
  success: boolean;
  fileId: string;
  fileSize: number;
  filePath: string;
}

// ─── Socket Events ─────────────────────────────────────────────────

export interface ProgressEvent {
  jobId: string;
  percent: number;
  bytesProcessed: number;
  compressedSize: number;
  speed: number;
  eta: number;
  compressionRatio: number;
}

export interface CompleteEvent {
  jobId: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  weissmanScore: number;
  timeTaken: number;
  downloadUrl: string;
}

export interface ErrorEvent {
  jobId: string;
  message: string;
}

// Server → Client events
export interface ServerToClientEvents {
  progress: (data: ProgressEvent) => void;
  complete: (data: CompleteEvent) => void;
  error: (data: ErrorEvent) => void;
}

// Client → Server events
export interface ClientToServerEvents {
  subscribe: (data: { jobId: string }) => void;
  unsubscribe: (data: { jobId: string }) => void;
}

// ─── Weissman Score ────────────────────────────────────────────────

/**
 * Calculate the Weissman Score
 * W = α × (r / log(T))
 *
 * @param ratio - Compression ratio (original / compressed)
 * @param timeSeconds - Time taken in seconds
 * @param alpha - Scaling constant (default: 1.0)
 */
export function calculateWeissmanScore(
  ratio: number,
  timeSeconds: number,
  alpha: number = 1.0
): number {
  if (timeSeconds <= 0 || ratio <= 0) return 0;
  const score = alpha * (ratio / Math.log(Math.max(timeSeconds, 1.01)));
  return Math.round(score * 100) / 100;
}

// ─── Constants ─────────────────────────────────────────────────────

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_CONCURRENT_UPLOADS = 5;
export const MAX_CONCURRENT_COMPRESSIONS = 3;
export const TEMP_FILE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const OUTPUT_FILE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_FILE_SIZE = 200 * 1024 * 1024 * 1024; // 200 GB

// ─── Utility Types ─────────────────────────────────────────────────

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}
