import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(""),

  UPLOAD_DIR: z.string().default("./uploads"),
  OUTPUT_DIR: z.string().default("./output"),

  MAX_CONCURRENT_COMPRESSIONS: z.coerce.number().default(3),
  DEFAULT_ALGORITHM: z.enum(["zstd", "gzip", "brotli", "deflate"]).default("zstd"),
  DEFAULT_COMPRESSION_LEVEL: z.coerce.number().default(3),

  MAX_FILE_SIZE_GB: z.coerce.number().default(200),
  CHUNK_SIZE_MB: z.coerce.number().default(5),
  MAX_CONCURRENT_UPLOADS: z.coerce.number().default(5),

  TEMP_FILE_TTL_HOURS: z.coerce.number().default(1),
  OUTPUT_FILE_TTL_HOURS: z.coerce.number().default(24),

  GEMINI_API_KEY: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
