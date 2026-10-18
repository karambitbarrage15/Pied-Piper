import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { type Algorithm } from "@pied-piper/shared";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface FileAnalysisResult {
  algorithm: Algorithm;
  level: number;
  predictedRatio: string;
  rationale: string;
  isPreCompressed: boolean;
  category: "text" | "archive" | "media" | "binary" | "database" | "unknown";
}

export class GeminiService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static getClient(): GoogleGenerativeAI | null {
    if (!this.genAI && env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0) {
      try {
        this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY.trim());
      } catch (err) {
        logger.warn({ err }, "Could not initialize GoogleGenerativeAI client");
      }
    }
    return this.genAI;
  }

  /**
   * Analyze file and recommend compression algorithm and level
   */
  static async analyzeFile(fileName: string, fileSize: number): Promise<FileAnalysisResult> {
    const ext = path.extname(fileName).toLowerCase().replace(".", "");

    // 1. Try Gemini AI if API key is present
    const client = this.getClient();
    if (client) {
      try {
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
You are the Pied Piper compression AI advisor. Analyze this file for optimal compression:
File Name: "${fileName}"
File Extension: "${ext}"
File Size: ${fileSize} bytes

Respond in strictly valid JSON without markdown fences:
{
  "algorithm": "zstd" | "gzip" | "brotli" | "deflate",
  "level": number,
  "predictedRatio": "e.g. 4.2x (76% reduction)",
  "rationale": "one concise sentence explaining why and what kind of file it is",
  "isPreCompressed": boolean,
  "category": "text" | "archive" | "media" | "binary" | "database" | "unknown"
}
`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        return {
          algorithm: parsed.algorithm || "zstd",
          level: Number(parsed.level) || 3,
          predictedRatio: parsed.predictedRatio || "3.5x",
          rationale: parsed.rationale || "Zstandard recommended for optimal throughput.",
          isPreCompressed: Boolean(parsed.isPreCompressed),
          category: parsed.category || "unknown",
        };
      } catch (err) {
        logger.warn({ err }, "Gemini API query failed, falling back to heuristic engine");
      }
    }

    // 2. Intelligent Heuristic Engine (always available offline)
    return this.heuristicAnalyze(fileName, ext, fileSize);
  }

  private static heuristicAnalyze(fileName: string, ext: string, _fileSize: number): FileAnalysisResult {
    const mediaExts = new Set(["mp4", "mkv", "avi", "mov", "mp3", "aac", "jpg", "jpeg", "png", "webp", "gif"]);
    const archiveExts = new Set(["zip", "gz", "tar", "bz2", "xz", "7z", "rar", "zst"]);
    const textExts = new Set(["txt", "json", "csv", "xml", "html", "css", "js", "ts", "md", "log", "sql", "yaml", "yml"]);
    const databaseExts = new Set(["db", "sqlite", "sql", "dump", "parquet", "avro"]);

    if (mediaExts.has(ext)) {
      return {
        algorithm: "zstd",
        level: 1,
        predictedRatio: "~1.05x (already pre-compressed media)",
        rationale: `${ext.toUpperCase()} is already encoded with lossy/lossless compression; use fast zstd level 1 to avoid wasted CPU.`,
        isPreCompressed: true,
        category: "media",
      };
    }

    if (archiveExts.has(ext)) {
      return {
        algorithm: "zstd",
        level: 1,
        predictedRatio: "~1.02x (already compressed archive)",
        rationale: `This archive (${ext}) is already compressed; compressing again will yield minimal savings.`,
        isPreCompressed: true,
        category: "archive",
      };
    }

    if (textExts.has(ext)) {
      return {
        algorithm: "zstd",
        level: 4,
        predictedRatio: "4.5x - 8.0x (~78-88% space saved)",
        rationale: `Structured ${ext.toUpperCase()} text has high entropy redundancy; Zstandard will compress this with extreme efficiency.`,
        isPreCompressed: false,
        category: "text",
      };
    }

    if (databaseExts.has(ext)) {
      return {
        algorithm: "zstd",
        level: 5,
        predictedRatio: "3.8x - 6.0x (~75% space saved)",
        rationale: `Database and table data contain repetitive row patterns ideal for Zstandard dictionary matching.`,
        isPreCompressed: false,
        category: "database",
      };
    }

    return {
      algorithm: "zstd",
      level: 3,
      predictedRatio: "2.5x - 4.0x (~65% space saved)",
      rationale: `General binary file "${fileName}" — Zstandard default level 3 offers the optimal speed/ratio sweet spot.`,
      isPreCompressed: false,
      category: "binary",
    };
  }
}
