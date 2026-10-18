import fs from "node:fs";
import { Router, type Request, type Response } from "express";
import { JobManager } from "../queue/compression.queue.js";
import { logger } from "../utils/logger.js";

const downloadRouter = Router();

/**
 * Stream download of compressed file (GET /api/download/:jobId)
 */
downloadRouter.get("/:jobId", (req: Request, res: Response): void => {
  try {
    const rawJobId = req.params.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;

    if (!jobId) {
      res.status(400).json({ error: "Missing jobId parameter" });
      return;
    }

    const outputInfo = JobManager.getOutputFile(jobId);
    if (!outputInfo || !fs.existsSync(outputInfo.filePath)) {
      res.status(404).json({ error: "Compressed file not found or compression not finished" });
      return;
    }

    const { filePath, fileName } = outputInfo;
    const stat = fs.statSync(filePath);

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);

    logger.info(`Streaming download for job ${jobId} (${fileName}, ${stat.size} bytes)`);

    const readStream = fs.createReadStream(filePath);
    readStream.on("error", (err) => {
      logger.error({ err }, `Error streaming download for ${jobId}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream download" });
      }
    });

    readStream.pipe(res);
  } catch (error) {
    logger.error({ err: error }, "Download endpoint error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error during download" });
    }
  }
});

export { downloadRouter };
