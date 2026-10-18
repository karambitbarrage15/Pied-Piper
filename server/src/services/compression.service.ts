import fs from "node:fs";
import zlib from "node:zlib";
import { Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Encoder } from "@toondepauw/node-zstd";
import {
  type Algorithm,
  calculateWeissmanScore,
  type ProgressEvent,
} from "@pied-piper/shared";
import { logger } from "../utils/logger.js";

/**
 * Progress tracking transform stream (zero overhead)
 */
export class ProgressTransform extends Transform {
  private bytesIn = 0;
  private bytesOut = 0;
  private lastEmitTime = 0;
  private startTime = Date.now();

  constructor(
    private totalBytes: number,
    private jobId: string,
    private onProgress?: (data: ProgressEvent) => void
  ) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.bytesIn += chunk.length;
    this.emitProgress();
    this.push(chunk);
    callback();
  }

  recordBytesOut(bytes: number): void {
    this.bytesOut += bytes;
  }

  private emitProgress(force: boolean = false): void {
    const now = Date.now();
    // Throttle progress emissions to every 200ms unless forced or complete
    if (!force && now - this.lastEmitTime < 200 && this.bytesIn < this.totalBytes) {
      return;
    }
    this.lastEmitTime = now;

    const elapsedSeconds = Math.max((now - this.startTime) / 1000, 0.05);
    const speed = Math.round(this.bytesIn / elapsedSeconds);
    const percent = Math.min(
      Math.round((this.bytesIn / Math.max(this.totalBytes, 1)) * 1000) / 10,
      100
    );
    const bytesRemaining = Math.max(this.totalBytes - this.bytesIn, 0);
    const eta = speed > 0 ? Math.round(bytesRemaining / speed) : 0;
    const ratio = this.bytesOut > 0 ? Math.round((this.bytesIn / this.bytesOut) * 100) / 100 : 1.0;

    if (this.onProgress) {
      this.onProgress({
        jobId: this.jobId,
        percent,
        bytesProcessed: this.bytesIn,
        compressedSize: this.bytesOut,
        speed,
        eta,
        compressionRatio: ratio,
      });
    }
  }

  flushFinal(): void {
    this.emitProgress(true);
  }

  getBytesIn(): number {
    return this.bytesIn;
  }

  getBytesOut(): number {
    return this.bytesOut;
  }
}

/**
 * Output tracker stream to count compressed bytes written
 */
export class OutputCounterTransform extends Transform {
  constructor(private progressTracker: ProgressTransform) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.progressTracker.recordBytesOut(chunk.length);
    this.push(chunk);
    callback();
  }
}

/**
 * Zstandard transform stream wrapper
 */
export function createZstdTransform(level: number = 3): Transform {
  const encoder = new Encoder(level);

  return new Transform({
    async transform(chunk: Buffer, _encoding, callback) {
      try {
        const compressed = await encoder.encode(chunk);
        this.push(compressed);
        callback();
      } catch (err) {
        callback(err as Error);
      }
    },
  });
}

/**
 * Create appropriate compression stream based on chosen algorithm
 */
export function createCompressionStream(algorithm: Algorithm, level?: number): Transform {
  switch (algorithm) {
    case "zstd":
      return createZstdTransform(level ?? 3);

    case "gzip":
      return zlib.createGzip({
        level: level ?? 6,
        chunkSize: 64 * 1024,
      });

    case "brotli":
      return zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: level ?? 4,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0,
        },
        chunkSize: 64 * 1024,
      });

    case "deflate":
      return zlib.createDeflate({
        level: level ?? 6,
        chunkSize: 64 * 1024,
      });

    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

export interface CompressFileOptions {
  jobId: string;
  inputPath: string;
  outputPath: string;
  algorithm: Algorithm;
  level?: number;
  originalSize: number;
  onProgress?: (progress: ProgressEvent) => void;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  weissmanScore: number;
  timeTakenMs: number;
  speedAvg: number;
}

export class CompressionService {
  /**
   * Stream compress a file with constant ~70MB memory usage regardless of file size
   */
  static async compressFile(options: CompressFileOptions): Promise<CompressionResult> {
    const startTime = Date.now();
    const { jobId, inputPath, outputPath, algorithm, level, originalSize, onProgress } = options;

    logger.info(
      `Starting ${algorithm} (level ${level ?? "default"}) compression for job ${jobId} (${originalSize} bytes)`
    );

    const readStream = fs.createReadStream(inputPath, { highWaterMark: 64 * 1024 });
    const progressStream = new ProgressTransform(originalSize, jobId, onProgress);
    const compressorStream = createCompressionStream(algorithm, level);
    const counterStream = new OutputCounterTransform(progressStream);
    const writeStream = fs.createWriteStream(outputPath, { highWaterMark: 64 * 1024 });

    try {
      // Connect pipeline: Read -> Progress In -> Compressor -> Progress Out -> Write
      await pipeline(readStream, progressStream, compressorStream, counterStream, writeStream);

      progressStream.flushFinal();

      const timeTakenMs = Date.now() - startTime;
      const timeTakenSec = Math.max(timeTakenMs / 1000, 0.05);

      const outputStats = await fs.promises.stat(outputPath);
      const compressedSize = outputStats.size;

      const compressionRatio =
        compressedSize > 0 ? Math.round((originalSize / compressedSize) * 100) / 100 : 1.0;

      const weissmanScore = calculateWeissmanScore(compressionRatio, timeTakenSec);
      const speedAvg = Math.round(originalSize / timeTakenSec);

      logger.info(
        `Job ${jobId} compressed successfully in ${timeTakenSec.toFixed(2)}s | ` +
          `Original: ${originalSize} -> Compressed: ${compressedSize} | ` +
          `Ratio: ${compressionRatio}x | Weissman: ${weissmanScore}`
      );

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        weissmanScore,
        timeTakenMs,
        speedAvg,
      };
    } catch (error) {
      logger.error({ err: error }, `Compression failed for job ${jobId}`);
      // Remove partial output file if failed
      if (fs.existsSync(outputPath)) {
        await fs.promises.unlink(outputPath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Helper to determine appropriate output extension
   */
  static getExtensionForAlgorithm(algorithm: Algorithm): string {
    switch (algorithm) {
      case "zstd":
        return ".zst";
      case "gzip":
        return ".gz";
      case "brotli":
        return ".br";
      case "deflate":
        return ".zz";
      default:
        return ".cmp";
    }
  }
}
