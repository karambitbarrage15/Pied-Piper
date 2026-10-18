import {
  ALGORITHMS,
  ALGORITHM_INFO,
  type Algorithm,
} from "@pied-piper/shared";

export class AlgorithmPicker {
  private element: HTMLElement;
  private selectedAlgorithm: Algorithm = "zstd";
  private selectedLevel: number = 3;
  private onAlgorithmChange?: (algo: Algorithm, level: number) => void;

  constructor(
    container: HTMLElement,
    callbacks?: { onAlgorithmChange?: (algo: Algorithm, level: number) => void }
  ) {
    this.onAlgorithmChange = callbacks?.onAlgorithmChange;
    this.element = document.createElement("div");
    this.element.className = "algorithm-section";
    container.appendChild(this.element);
    this.render();
  }

  private render(): void {
    const currentInfo = ALGORITHM_INFO[this.selectedAlgorithm];

    this.element.innerHTML = `
      <div class="section-label">
        <span>Compression Algorithm</span>
        <span>Selected: <strong style="color: var(--accent-green);">${currentInfo.name}</strong></span>
      </div>

      <div class="algorithm-grid">
        ${ALGORITHMS.map((algoId) => {
          const info = ALGORITHM_INFO[algoId];
          const isSelected = algoId === this.selectedAlgorithm;
          const isRecommended = algoId === "zstd";

          return `
            <div class="algo-card ${isSelected ? "selected" : ""}" data-algo="${algoId}">
              <div class="algo-header">
                <span class="algo-name">${info.name}</span>
                ${isRecommended ? `<span class="algo-badge">RECOMMENDED</span>` : ""}
              </div>
              <p class="algo-desc">${info.description}</p>
              <div class="algo-ratings">
                <span>Speed: <strong class="algo-rating-tag">${info.speedRating}</strong></span>
                <span>Ratio: <strong class="algo-rating-tag">${info.ratioRating}</strong></span>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="level-slider-card">
        <div class="slider-header">
          <span>Compression Level</span>
          <span>Level: <strong id="levelDisplay" style="color: var(--accent-green);">${this.selectedLevel}</strong> / ${currentInfo.maxLevel}</span>
        </div>
        <input 
          type="range" 
          id="levelSlider" 
          class="slider-input" 
          min="1" 
          max="${currentInfo.maxLevel}" 
          value="${this.selectedLevel}" 
        />
      </div>
    `;

    // Attach listeners
    const cards = this.element.querySelectorAll(".algo-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const algo = card.getAttribute("data-algo") as Algorithm;
        if (algo && algo !== this.selectedAlgorithm) {
          this.setAlgorithm(algo);
        }
      });
    });

    const slider = this.element.querySelector("#levelSlider") as HTMLInputElement;
    const levelDisplay = this.element.querySelector("#levelDisplay") as HTMLElement;

    slider.addEventListener("input", () => {
      this.selectedLevel = parseInt(slider.value, 10);
      levelDisplay.textContent = String(this.selectedLevel);
      if (this.onAlgorithmChange) {
        this.onAlgorithmChange(this.selectedAlgorithm, this.selectedLevel);
      }
    });
  }

  setAlgorithm(algorithm: Algorithm): void {
    this.selectedAlgorithm = algorithm;
    const info = ALGORITHM_INFO[algorithm];
    this.selectedLevel = info.defaultLevel;
    this.render();
    if (this.onAlgorithmChange) {
      this.onAlgorithmChange(this.selectedAlgorithm, this.selectedLevel);
    }
  }

  getSelected(): { algorithm: Algorithm; level: number } {
    return {
      algorithm: this.selectedAlgorithm,
      level: this.selectedLevel,
    };
  }
}
