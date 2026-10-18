import "./styles/index.css";
import "./styles/components.css";

import { DropZone } from "./components/DropZone.js";
import { AlgorithmPicker } from "./components/AlgorithmPicker.js";
import { Dashboard } from "./components/Dashboard.js";
import { ParticleCanvas } from "./components/ParticleCanvas.js";
import { ChunkedUploader } from "./lib/uploader.js";
import { createSocketClient } from "./lib/socket.js";
import { trpc } from "./lib/trpc.js";
import type { Algorithm } from "@pied-piper/shared";

// Initialize App Shell
const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="container">
    <header class="app-header">
      <div class="brand-wrapper">
        <div class="logo-badge">PP</div>
        <div>
          <h1 class="brand-title">Pied Piper</h1>
          <p class="brand-subtitle">Middle-Out Compression Engine</p>
        </div>
      </div>
      <div class="header-status">
        <span class="status-dot"></span>
        <span id="socketStatusText">Engine Ready</span>
      </div>
    </header>

    <section class="hero-section">
      <div class="hero-badge">⚡ Zstandard 3-5x Faster Than Gzip • Constant ~70MB RAM</div>
      <h2 class="hero-title">Compress 100GB+ Files <br/><span class="hero-gradient-text">Without Freezing Your Machine</span></h2>
      <p class="hero-desc">Powered by stream pipelines, parallel chunked uploads, and the legendary Weissman-scored Middle-Out compression architecture.</p>
    </section>

    <div class="particle-canvas-wrapper" id="canvasWrapper"></div>

    <div id="aiBannerContainer"></div>

    <div id="dropzoneContainer"></div>

    <div id="algoContainer"></div>

    <button id="btnCompress" class="btn-primary" disabled>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="14" y1="10" x2="21" y2="3"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
      Compress File (Middle-Out)
    </button>

    <div id="dashboardContainer"></div>
  </div>
`;

// DOM Elements
const canvasWrapper = document.getElementById("canvasWrapper")!;
const dropzoneContainer = document.getElementById("dropzoneContainer")!;
const algoContainer = document.getElementById("algoContainer")!;
const dashboardContainer = document.getElementById("dashboardContainer")!;
const btnCompress = document.getElementById("btnCompress") as HTMLButtonElement;
const socketStatusText = document.getElementById("socketStatusText")!;

// Instantiate Components
const particleCanvas = new ParticleCanvas(canvasWrapper);
const dashboard = new Dashboard(dashboardContainer);
const algoPicker = new AlgorithmPicker(algoContainer);

let selectedFile: File | null = null;
const socket = createSocketClient();

socket.on("connect", () => {
  socketStatusText.textContent = "Engine Connected";
});

socket.on("disconnect", () => {
  socketStatusText.textContent = "Engine Reconnecting...";
});

// Dropzone initialization
new DropZone(dropzoneContainer, {
  onFileSelected: (file: File) => {
    selectedFile = file;
    btnCompress.disabled = false;
    btnCompress.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="14" y1="10" x2="21" y2="3"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
      Compress "${escapeHtml(file.name)}"
    `;
  },
  onFileCleared: () => {
    selectedFile = null;
    btnCompress.disabled = true;
    btnCompress.innerHTML = `Compress File (Middle-Out)`;
    dashboard.hide();
    particleCanvas.setMode("idle");
  },
});

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return m;
    }
  });
}

// Compress Action Workflow
btnCompress.addEventListener("click", async () => {
  if (!selectedFile) return;

  btnCompress.disabled = true;
  btnCompress.textContent = "Processing Stream...";
  dashboard.show();
  particleCanvas.setMode("compressing");

  const originalSize = selectedFile.size;
  const { algorithm, level } = algoPicker.getSelected();

  try {
    // ─── PHASE 1: Chunked Upload ──────────────────────────
    dashboard.render({
      phase: "uploading",
      percent: 0,
      originalSize,
    });

    const uploader = new ChunkedUploader(selectedFile, (progress) => {
      dashboard.render({
        phase: "uploading",
        percent: progress.percent,
        originalSize,
        speed: progress.speed,
      });
    });

    const uploadResult = await uploader.upload();

    // ─── PHASE 2: Trigger Compression Job via tRPC ────────
    dashboard.render({
      phase: "compressing",
      percent: 0,
      originalSize,
    });

    const startRes = await trpc.compress.start.mutate({
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
      algorithm: algorithm as Algorithm,
      level,
    });

    const jobId = startRes.jobId;

    // ─── PHASE 3: Subscribe to Live WebSocket Events ───────
    socket.emit("subscribe", { jobId });

    socket.on("progress", (event) => {
      if (event.jobId === jobId) {
        dashboard.updateProgress(event, originalSize);
      }
    });

    socket.on("complete", (event) => {
      if (event.jobId === jobId) {
        dashboard.updateCompleted(event);
        particleCanvas.setMode("burst");
        btnCompress.disabled = false;
        btnCompress.textContent = "Compress Another File";
        socket.emit("unsubscribe", { jobId });
      }
    });

    socket.on("error", (event) => {
      if (event.jobId === jobId) {
        dashboard.render({
          phase: "error",
          percent: 0,
          originalSize,
          errorMessage: event.message,
        });
        particleCanvas.setMode("idle");
        btnCompress.disabled = false;
        btnCompress.textContent = "Try Again";
        socket.emit("unsubscribe", { jobId });
      }
    });
  } catch (error) {
    console.error("Compression flow error:", error);
    dashboard.render({
      phase: "error",
      percent: 0,
      originalSize,
      errorMessage: error instanceof Error ? error.message : "Upload or compression failed",
    });
    particleCanvas.setMode("idle");
    btnCompress.disabled = false;
    btnCompress.textContent = "Try Again";
  }
});
