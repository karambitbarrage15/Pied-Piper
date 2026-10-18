interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay?: number;
}

export class ParticleCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private mode: "idle" | "compressing" | "burst" = "idle";
  private width: number = 0;
  private height: number = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "particle-canvas";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.start();
  }

  private resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  setMode(mode: "idle" | "compressing" | "burst"): void {
    this.mode = mode;
    if (mode === "burst") {
      this.triggerBurst();
    }
  }

  private triggerBurst(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const colors = ["#00ff88", "#00b4d8", "#ffffff", "#9d4edd"];

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02,
      });
    }
  }

  private spawnMiddleOutParticle(): void {
    if (this.particles.length > 150) return;

    const cx = this.width / 2;
    const cy = this.height / 2;

    // Spawn from outer edges
    let x = 0;
    let y = 0;
    if (Math.random() > 0.5) {
      x = Math.random() > 0.5 ? 0 : this.width;
      y = Math.random() * this.height;
    } else {
      x = Math.random() * this.width;
      y = Math.random() > 0.5 ? 0 : this.height;
    }

    const dx = cx - x;
    const dy = cy - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 1.5 + Math.random() * 3.5;

    this.particles.push({
      x,
      y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      size: 1.5 + Math.random() * 2,
      color: Math.random() > 0.4 ? "#00ff88" : "#00b4d8",
      alpha: 0.2 + Math.random() * 0.8,
    });
  }

  private loop(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.mode === "compressing") {
      this.spawnMiddleOutParticle();
      this.spawnMiddleOutParticle();
    }

    // Draw center core glow when compressing
    if (this.mode === "compressing" || this.mode === "burst") {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
      grad.addColorStop(0, "rgba(0, 255, 136, 0.35)");
      grad.addColorStop(1, "rgba(0, 255, 136, 0)");
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      this.ctx.fill();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.decay) {
        p.alpha -= p.decay;
      }

      const cx = this.width / 2;
      const cy = this.height / 2;
      const distToCenter = Math.hypot(cx - p.x, cy - p.y);

      // In compressing mode, absorb particles when they reach the middle
      if (this.mode === "compressing" && distToCenter < 12) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(p.alpha, 0);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  start(): void {
    if (!this.animationId) {
      this.loop();
    }
  }

  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
