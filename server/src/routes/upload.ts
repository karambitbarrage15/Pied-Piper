import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { FileService } from "../services/file.service.js";
import { logger } from "../utils/logger.js";
import { CHUNK_SIZE } from "@pied-piper/shared";

const uploadRouter = Router();

// Configure multer with memory storage (5MB max chunk buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CHUNK_SIZE + 1024 * 1024, // 6 MB limit per chunk
  },
});

const chunkQuerySchema = z.object({
  fileId: z.string().min(1),
  chunkIndex: z.coerce.number().int().min(0),
  totalChunks: z.coerce.number().int().min(1),
  fileName: z.string().min(1),
});

const completeBodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().min(1),
  totalChunks: z.coerce.number().int().min(1),
  totalSize: z.coerce.number().positive(),
});

/**
 * Upload a single chunk (POST /api/upload/chunk)
 */
uploadRouter.post(
  "/chunk",
  upload.single("chunk"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Missing chunk binary file in request" });
        return;
      }

      const parseResult = chunkQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: "Invalid chunk parameters",
          details: parseResult.error.flatten(),
        });
        return;
      }

      const { fileId, chunkIndex, totalChunks, fileName } = parseResult.data;

      const bytesSaved = await FileService.saveChunk(fileId, chunkIndex, req.file.buffer);

      logger.debug(
        `Chunk ${chunkIndex + 1}/${totalChunks} saved for ${fileName} (${bytesSaved} bytes)`
      );

      res.status(200).json({
        success: true,
        chunkIndex,
        received: bytesSaved,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to save upload chunk");
      res.status(500).json({ error: "Failed to save chunk to disk" });
    }
  }
);

/**
 * Check upload status / uploaded chunks for resumability (GET /api/upload/status/:fileId)
 */
uploadRouter.get("/status/:fileId", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawFileId = req.params.fileId;
    const fileId = Array.isArray(rawFileId) ? rawFileId[0] : rawFileId;
    if (!fileId) {
      res.status(400).json({ error: "Missing fileId parameter" });
      return;
    }

    const uploadedChunks = await FileService.getUploadedChunks(fileId);
    res.json({
      fileId,
      uploadedChunks,
      count: uploadedChunks.length,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to get upload status");
    res.status(500).json({ error: "Failed to inspect upload status" });
  }
});

/**
 * Finalize and stream-assemble file (POST /api/upload/complete)
 */
uploadRouter.post("/complete", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = completeBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid completion payload",
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { fileId, fileName, totalChunks, totalSize } = parseResult.data;

    const { filePath, fileSize } = await FileService.assembleChunks(
      fileId,
      fileName,
      totalChunks
    );

    // Optional verification of file size
    if (totalSize && Math.abs(fileSize - totalSize) > 0) {
      logger.warn(
        `File size mismatch for ${fileName}: expected ${totalSize}, assembled ${fileSize}`
      );
    }

    res.status(200).json({
      success: true,
      fileId,
      fileName,
      fileSize,
      filePath,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to finalize chunked upload");
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to assemble file",
    });
  }
});

export { uploadRouter };
