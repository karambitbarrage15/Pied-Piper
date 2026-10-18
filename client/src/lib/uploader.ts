import { CHUNK_SIZE } from "@pied-piper/shared";

export interface UploadProgress {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  filePath: string;
}

export class ChunkedUploader {
  private fileId: string;
  private aborted: boolean = false;
  private startTime: number = 0;
  private bytesUploaded: number = 0;

  constructor(
    private file: File,
    private onProgress?: (progress: UploadProgress) => void
  ) {
    this.fileId = this.generateId();
  }

  private generateId(): string {
    return "f_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
  }

  abort(): void {
    this.aborted = true;
  }

  async upload(maxConcurrent: number = 3): Promise<UploadResult> {
    this.startTime = Date.now();
    this.aborted = false;
    const totalSize = this.file.size;
    const totalChunks = Math.max(Math.ceil(totalSize / CHUNK_SIZE), 1);

    // Check already uploaded chunks for resumability
    let existingChunks: Set<number> = new Set();
    try {
      const statusRes = await fetch(`/api/upload/status/${this.fileId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        existingChunks = new Set(data.uploadedChunks || []);
      }
    } catch {
      // Continue with clean upload
    }

    const pendingChunks: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      if (!existingChunks.has(i)) {
        pendingChunks.push(i);
      } else {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        this.bytesUploaded += end - start;
      }
    }

    // Worker pool for parallel chunk uploads
    const uploadWorker = async (): Promise<void> => {
      while (pendingChunks.length > 0 && !this.aborted) {
        const chunkIndex = pendingChunks.shift();
        if (chunkIndex === undefined) break;

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkBlob = this.file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunkBlob, `chunk_${chunkIndex}`);
        formData.append("fileId", this.fileId);
        formData.append("chunkIndex", String(chunkIndex));
        formData.append("totalChunks", String(totalChunks));
        formData.append("fileName", this.file.name);

        let retries = 3;
        let success = false;

        while (retries > 0 && !success && !this.aborted) {
          try {
            const res = await fetch("/api/upload/chunk", {
              method: "POST",
              body: formData,
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            success = true;

            this.bytesUploaded += chunkBlob.size;
            const elapsed = Math.max((Date.now() - this.startTime) / 1000, 0.05);
            const speed = Math.round(this.bytesUploaded / elapsed);
            const percent = Math.min(
              Math.round((this.bytesUploaded / Math.max(totalSize, 1)) * 1000) / 10,
              100
            );

            if (this.onProgress) {
              this.onProgress({
                percent,
                uploadedBytes: this.bytesUploaded,
                totalBytes: totalSize,
                speed,
              });
            }
          } catch (err) {
            retries--;
            if (retries === 0) {
              throw new Error(`Failed to upload chunk ${chunkIndex} after 3 attempts`);
            }
            await new Promise((r) => setTimeout(r, 800));
          }
        }
      }
    };

    // Execute concurrent workers
    const workers = Array.from({ length: Math.min(maxConcurrent, pendingChunks.length || 1) }, () =>
      uploadWorker()
    );
    await Promise.all(workers);

    if (this.aborted) {
      throw new Error("Upload aborted by user");
    }

    // Finalize and assemble chunks on server
    const completeRes = await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: this.fileId,
        fileName: this.file.name,
        totalChunks,
        totalSize,
      }),
    });

    if (!completeRes.ok) {
      const err = await completeRes.json();
      throw new Error(err.error || "Failed to finalize upload on server");
    }

    const completeData = await completeRes.json();
    return {
      fileId: this.fileId,
      fileName: this.file.name,
      fileSize: completeData.fileSize,
      filePath: completeData.filePath,
    };
  }
}
