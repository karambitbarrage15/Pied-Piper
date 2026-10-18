import {
  formatBytes,
  formatSpeed,
  formatDuration,
  type CompleteEvent,
  type ProgressEvent,
} from "@pied-piper/shared";

export class Dashboard {
  private element: HTMLElement;
  private isVisible: boolean = false;

  constructor(container: HTMLElement) {
    this.element = document.createElement("div");
    this.element.id = "dashboardSection";
    this.element.style.display = "none";
    container.appendChild(this.element);
  }

  show(): void {
    this.isVisible = true;
    this.element.style.display = "block";
    this.render();
  }

  hide(): void {
    this.isVisible = false;
    this.element.style.display = "none";
  }

  render(data?: {
    phase: "uploading" | "compressing" | "completed" | "error";
    percent: number;
    originalSize: number;
    compressedSize?: number | null;
    speed?: number;
    eta?: number;
    compressionRatio?: number | null;
    weissmanScore?: number | null;
    downloadUrl?: string | null;
    errorMessage?: string | null;
  }): void {
    if (!this.isVisible) return;

    const phase = data?.phase || "uploading";
    const percent = data?.percent || 0;
    const originalSize = data?.originalSize ? formatBytes(data.originalSize) : "--";
    const compressedSize = data?.compressedSize ? formatBytes(data.compressedSize) : "--";
    const ratio = data?.compressionRatio ? `${data.compressionRatio}x` : "--";
    const weissman = data?.weissmanScore ? data.weissmanScore.toLocaleString() : "--";
    const speed = data?.speed ? formatSpeed(data.speed) : "--";
    const eta = data?.eta ? formatDuration(data.eta) : "--";

    let phaseBadgeText = "Uploading Chunks...";
    if (phase === "compressing") phaseBadgeText = "Compressing (Middle-Out)...";
    if (phase === "completed") phaseBadgeText = "Compression Complete!";
    if (phase === "error") phaseBadgeText = "Error Occurred";

    this.element.innerHTML = `
      <div class="glass-card progress-card">
        <div class="progress-header">
          <span style="color: var(--accent-green); font-weight: 600;">⚡ ${phaseBadgeText}</span>
          <span style="color: #fff; font-weight: 700;">${percent.toFixed(1)}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percent}%;"></div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-label">Original Size</div>
          <div class="stat-value">${originalSize}</div>
          <div class="stat-sub">Source File</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Compressed Size</div>
          <div class="stat-value" id="valCompressed">${compressedSize}</div>
          <div class="stat-sub" style="color: var(--accent-blue);">Processed Stream</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Compression Ratio</div>
          <div class="stat-value" style="color: var(--accent-green);">${ratio}</div>
          <div class="stat-sub">Space Optimization</div>
        </div>

        <div class="stat-card weissman-card">
          <div class="stat-label">Weissman Score</div>
          <div class="stat-value">${weissman}</div>
          <div class="stat-sub">Silicon Valley Metric</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Throughput Speed</div>
          <div class="stat-value">${speed}</div>
          <div class="stat-sub">Stream Velocity</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Estimated Time</div>
          <div class="stat-value">${eta}</div>
          <div class="stat-sub">Remaining</div>
        </div>
      </div>

      ${
        phase === "completed" && data?.downloadUrl
          ? `
        <div class="download-action-card">
          <div class="download-title">🎉 File Compressed Successfully!</div>
          <p class="download-subtitle">Achieved a Weissman score of <strong>${weissman}</strong> with a <strong>${ratio}</strong> compression ratio.</p>
          <a href="${data.downloadUrl}" class="btn-download" download>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Compressed File
          </a>
        </div>
      `
          : ""
      }

      ${
        phase === "error"
          ? `
        <div class="glass-card" style="padding: 1.5rem; border-color: #ef4444; background: rgba(239, 68, 68, 0.1); margin-bottom: 2rem;">
          <h4 style="color: #ef4444; margin-bottom: 0.5rem;">⚠️ Compression Error</h4>
          <p style="color: var(--text-muted); font-size: 0.9rem;">${data?.errorMessage || "An unexpected error occurred during processing."}</p>
        </div>
      `
          : ""
      }
    `;
  }

  updateProgress(event: ProgressEvent, originalSize: number): void {
    this.render({
      phase: "compressing",
      percent: event.percent,
      originalSize,
      compressedSize: event.compressedSize,
      speed: event.speed,
      eta: event.eta,
      compressionRatio: event.compressionRatio,
    });
  }

  updateCompleted(event: CompleteEvent): void {
    this.render({
      phase: "completed",
      percent: 100,
      originalSize: event.originalSize,
      compressedSize: event.compressedSize,
      compressionRatio: event.compressionRatio,
      weissmanScore: event.weissmanScore,
      downloadUrl: event.downloadUrl,
    });
  }
}
