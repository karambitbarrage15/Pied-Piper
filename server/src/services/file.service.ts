import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);
const OUTPUT_ROOT = path.resolve(env.OUTPUT_DIR);
const TEMP_ROOT = path.join(UPLOAD_ROOT, "temp");

// Ensure directories exist
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
fs.mkdirSync(TEMP_ROOT, { recursive: true });

export class FileService {
  /**
   * Get the directory for a specific file's chunks
   */
  static getTempDir(fileId: string): string {
    const dir = path.join(TEMP_ROOT, fileId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Path for an individual chunk file
   */
  static getChunkPath(fileId: string, chunkIndex: number): string {
    return path.join(this.getTempDir(fileId), `chunk_${String(chunkIndex).padStart(8, "0")}`);
  }

  /**
   * Save an uploaded chunk to disk
   */
  static async saveChunk(fileId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<number> {
    const chunkPath = this.getChunkPath(fileId, chunkIndex);
    await fsPromises.writeFile(chunkPath, chunkBuffer);
    return chunkBuffer.length;
  }

  /**
   * Check which chunks are already uploaded (for resuming interrupted uploads)
   */
  static async getUploadedChunks(fileId: string): Promise<number[]> {
    const tempDir = path.join(TEMP_ROOT, fileId);
    if (!fs.existsSync(tempDir)) {
      return [];
    }
    const files = await fsPromises.readdir(tempDir);
    return files
      .filter((name) => name.startsWith("chunk_"))
      .map((name) => parseInt(name.replace("chunk_", ""), 10))
      .sort((a, b) => a - b);
  }

  /**
   * Assemble all chunks sequentially using streams (zero-RAM buffering)
   */
  static async assembleChunks(
    fileId: string,
    fileName: string,
    totalChunks: number
  ): Promise<{ filePath: string; fileSize: number }> {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetFilePath = path.join(UPLOAD_ROOT, `${fileId}_${sanitizedName}`);
    const writeStream = fs.createWriteStream(targetFilePath, { flags: "w" });

    logger.info(`Starting stream assembly for file: ${fileName} (${totalChunks} chunks)`);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = this.getChunkPath(fileId, i);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Missing chunk ${i} of ${totalChunks} for fileId ${fileId}`);
        }

        const readStream = fs.createReadStream(chunkPath);
        // Pipe chunk into the assembled file without closing writeStream until done
        await new Promise<void>((resolve, reject) => {
          readStream.on("error", reject);
          readStream.on("end", resolve);
          readStream.pipe(writeStream, { end: false });
        });
      }

      // Close the assembled file stream
      await new Promise<void>((resolve, reject) => {
        writeStream.end((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const stats = await fsPromises.stat(targetFilePath);
      logger.info(`File assembled successfully: ${targetFilePath} (${stats.size} bytes)`);

      // Cleanup chunks in background
      this.cleanupChunks(fileId).catch((err) => {
        logger.warn({ err }, `Failed to clean up temp chunks for ${fileId}`);
      });

      return {
        filePath: targetFilePath,
        fileSize: stats.size,
      };
    } catch (error) {
      writeStream.destroy();
      // Delete incomplete target file
      if (fs.existsSync(targetFilePath)) {
        await fsPromises.unlink(targetFilePath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Remove temporary chunks directory for a file
   */
  static async cleanupChunks(fileId: string): Promise<void> {
    const tempDir = path.join(TEMP_ROOT, fileId);
    if (fs.existsSync(tempDir)) {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Cleanup expired temp and output files based on TTL
   */
  static async cleanupOldFiles(): Promise<void> {
    const now = Date.now();
    const tempTtlMs = env.TEMP_FILE_TTL_HOURS * 60 * 60 * 1000;
    const outputTtlMs = env.OUTPUT_FILE_TTL_HOURS * 60 * 60 * 1000;

    // Clean old assembled uploads
    try {
      const uploadFiles = await fsPromises.readdir(UPLOAD_ROOT);
      for (const file of uploadFiles) {
        if (file === "temp") continue;
        const filePath = path.join(UPLOAD_ROOT, file);
        const stats = await fsPromises.stat(filePath);
        if (now - stats.mtimeMs > tempTtlMs) {
          await fsPromises.unlink(filePath).catch(() => {});
          logger.debug(`Cleaned up expired upload: ${file}`);
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "Error during upload cleanup");
    }

    // Clean old compressed outputs
    try {
      const outputFiles = await fsPromises.readdir(OUTPUT_ROOT);
      for (const file of outputFiles) {
        const filePath = path.join(OUTPUT_ROOT, file);
        const stats = await fsPromises.stat(filePath);
        if (now - stats.mtimeMs > outputTtlMs) {
          await fsPromises.unlink(filePath).catch(() => {});
          logger.debug(`Cleaned up expired output: ${file}`);
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "Error during output cleanup");
    }
  }
}
