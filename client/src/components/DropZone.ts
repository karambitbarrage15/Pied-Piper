import { formatBytes } from "@pied-piper/shared";

export class DropZone {
  private element: HTMLElement;
  private selectedFile: File | null = null;
  private onFileSelected?: (file: File) => void;
  private onFileCleared?: () => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onFileSelected?: (file: File) => void;
      onFileCleared?: () => void;
    }
  ) {
    this.onFileSelected = callbacks.onFileSelected;
    this.onFileCleared = callbacks.onFileCleared;
    this.element = document.createElement("div");
    container.appendChild(this.element);
    this.render();
  }

  private render(): void {
    if (!this.selectedFile) {
      this.element.innerHTML = `
        <div class="dropzone-container" id="dropzoneBox">
          <input type="file" id="fileInput" class="hidden-file-input" />
          <div class="dropzone-icon-wrapper">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <h3 class="dropzone-title">Drop your file here or click to browse</h3>
          <p class="dropzone-subtitle">Ready for files of any size — 100MB, 5GB, or 100GB+</p>
          <div class="dropzone-meta">
            <span>⚡ 5MB Chunk Streaming</span>
            <span>🔒 Zero RAM Buffering</span>
            <span>🎯 Weissman Scored</span>
          </div>
        </div>
      `;

      const box = this.element.querySelector("#dropzoneBox") as HTMLElement;
      const input = this.element.querySelector("#fileInput") as HTMLInputElement;

      box.addEventListener("click", () => input.click());

      input.addEventListener("change", (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0]) {
          this.setFile(files[0]);
        }
      });

      box.addEventListener("dragover", (e) => {
        e.preventDefault();
        box.classList.add("drag-active");
      });

      box.addEventListener("dragleave", () => {
        box.classList.remove("drag-active");
      });

      box.addEventListener("drop", (e) => {
        e.preventDefault();
        box.classList.remove("drag-active");
        if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
          this.setFile(e.dataTransfer.files[0]);
        }
      });
    } else {
      this.element.innerHTML = `
        <div class="file-selected-card">
          <div class="file-info-group">
            <div class="file-icon">📄</div>
            <div class="file-details">
              <h4>${this.escapeHtml(this.selectedFile.name)}</h4>
              <p>${formatBytes(this.selectedFile.size)} • Ready for Middle-Out Compression</p>
            </div>
          </div>
          <button class="btn-remove" id="btnRemoveFile">Change File</button>
        </div>
      `;

      const btnRemove = this.element.querySelector("#btnRemoveFile") as HTMLButtonElement;
      btnRemove.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clear();
      });
    }
  }

  setFile(file: File): void {
    this.selectedFile = file;
    this.render();
    if (this.onFileSelected) {
      this.onFileSelected(file);
    }
  }

  clear(): void {
    this.selectedFile = null;
    this.render();
    if (this.onFileCleared) {
      this.onFileCleared();
    }
  }

  getFile(): File | null {
    return this.selectedFile;
  }

  private escapeHtml(str: string): string {
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
}
