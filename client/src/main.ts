// Pied Piper — Client entry point (placeholder for Phase 7)
// Will build the full UI here

console.log("🎵 Pied Piper — Middle-Out Compression");
console.log("📦 Phase 1 complete — project scaffold ready!");
console.log("🔜 Phase 7 will build the full UI");

const app = document.getElementById("app")!;
app.innerHTML = `
  <div style="
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a1a 100%);
    font-family: 'Space Grotesk', sans-serif;
    color: #ffffff;
  ">
    <div style="text-align: center;">
      <h1 style="
        font-size: 3rem;
        font-weight: 700;
        background: linear-gradient(135deg, #00ff88, #00aaff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
      ">Pied Piper</h1>
      <p style="color: #888; font-size: 1.1rem; margin-bottom: 2rem;">Middle-Out Compression</p>
      <div style="
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(0,255,136,0.2);
        border-radius: 12px;
        padding: 1.5rem 2rem;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.9rem;
        color: #00ff88;
      ">
        ✅ Phase 1 — Project scaffold ready<br/>
        🔜 Phase 2 — Server core (Express + tRPC + Socket.io)<br/>
        🔜 Phase 3 — Chunked upload system<br/>
        🔜 Phase 4 — Compression engine (zstd)<br/>
        🔜 Phase 5 — tRPC procedures<br/>
        🔜 Phase 6 — Socket.io progress<br/>
        🔜 Phase 7 — Frontend UI<br/>
        🔜 Phase 8 — CSS design system<br/>
        🔜 Phase 9 — Gemini AI<br/>
        🔜 Phase 10 — Integration
      </div>
    </div>
  </div>
`;
