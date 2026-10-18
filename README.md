# 🎵 Pied Piper — Middle-Out Compression

> Inspired by HBO's Silicon Valley — a full-stack file compression service that handles files of **any size** (even 100GB+) without breaking a sweat.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## ✨ Features

- 🗜️ **Zstandard compression** — 3-5x faster than gzip at better ratios
- 📦 **Chunked uploads** — resumable, parallel, handles 100GB+ files
- ⚡ **Stream processing** — constant ~70MB RAM regardless of file size
- 📊 **Real-time progress** — live speed, ETA, compression ratio via WebSockets
- 🎯 **Weissman Score** — the real metric from Silicon Valley
- 🤖 **AI analysis** — Gemini-powered file analysis & algorithm recommendations
- 🎨 **Premium UI** — dark theme, glassmorphism, particle animations

## 🏗️ Architecture

| Component | Technology |
|---|---|
| Frontend | Vite + TypeScript (vanilla) |
| API | tRPC (typed) + Express (file streams) |
| Real-time | Socket.io (WebSockets) |
| Job Queue | BullMQ + Redis |
| Compression | Zstandard (`@napi-rs/zstd`) + gzip/brotli fallbacks |
| AI | Gemini API (optional) |

## 📁 Project Structure

```
pied-piper/
├── client/          # Vite + TypeScript frontend
├── server/          # Express + tRPC + Socket.io backend
├── shared/          # Shared types & constants
└── docker-compose.yml  # Redis
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Docker Desktop (for Redis)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/karambitbarrage15/Pied-Piper.git
cd Pied-Piper

# 2. Install dependencies
npm install

# 3. Start Redis
docker-compose up -d

# 4. Copy environment config
cp server/.env.example server/.env

# 5. Start development servers
npm run dev
```

The frontend runs on `http://localhost:5173` and the server on `http://localhost:3001`.

## 📊 How It Handles 100GB Files

| Resource | Usage |
|---|---|
| RAM | ~70 MB constant (streaming, never loads full file) |
| CPU | 1 Worker Thread (non-blocking) |
| Disk | Original + compressed output |
| Time | ~5 min at zstd level 3 on SSD |

## 🧮 Weissman Score

```
W = α × (r / log(T))

r = compression ratio
T = time in seconds
α = scaling constant
```

## 📜 License

MIT
