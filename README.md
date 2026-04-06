# cf_ai_ — Cloudflare AI Layer

Real-time video ranking pipeline extended with a Cloudflare AI layer: Workers AI (Llama 3), Durable Objects for conversation memory, and an AI chat panel in the dashboard.

---

## Cloudflare AI Components

| Component | Implementation |
|-----------|----------------|
| **LLM** | Workers AI — `@cf/meta/llama-3-8b-instruct` (Llama 3) |
| **Workflow / coordination** | Cloudflare Worker (`cloudflare-worker/`) orchestrates: load history → call LLM → save history |
| **User input (chat)** | AI chat panel in the Next.js dashboard (`AIChatPanel.tsx`) via `/api/cf` proxy |
| **Memory / state** | `ConversationHistory` Durable Object — SQLite-backed, persists per-user conversation context |

### How it fits together

```
Dashboard (chat UI)
  └─► Next.js /api/cf proxy          (hides Worker URL from browser)
        └─► Cloudflare Worker /chat  (Workers AI + Durable Object)
              ├─ load history        ConversationHistory DO (per userId)
              ├─ call LLM            Workers AI Llama 3
              └─ save history        ConversationHistory DO

Go AI Worker (cmd/ai-worker)
  └─► Kafka topic (same events as ranking worker, separate consumer group)
        └─► Cloudflare Worker /analyze  (async heartbeat ingestion)
```

---

## Running the Cloudflare Worker

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com) (free plan works)
- Node.js 18+
- `npm install -g wrangler` then `wrangler login`

### Deploy

```bash
cd cloudflare-worker
npm install
npx wrangler deploy
```

After deploy, Wrangler prints your Worker URL:

```
https://ranking-ai-worker.<your-subdomain>.workers.dev
```

### Try the chat endpoint directly

```bash
curl -X POST https://ranking-ai-worker.<your-subdomain>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user", "message": "What makes a video trend quickly?"}'
```

### Use with the full dashboard (Docker)

1. Copy `.env.example` to `.env`
2. Set `CLOUDFLARE_WORKER_URL` to your deployed Worker URL
3. Run `make up` — the dashboard chat panel will connect to the Worker automatically

```bash
cp .env.example .env
# edit .env → CLOUDFLARE_WORKER_URL=https://ranking-ai-worker.<your-subdomain>.workers.dev
make up
```

Open **http://localhost:3002** and use the **AI Chat** panel at the bottom of the dashboard.

-----------------------------------------------------------------------------------------------------------------------------------

# Contents Ranking

Real-time video ranking system based on watch heartbeats. Built with Go, Kafka, Redis, NestJS simulation, and Next.js dashboard.

---

## What this project is about

`contents-ranking` is a learning project for building **real‑time content ranking and recommendation pipelines** from raw watch heartbeats. Instead of counting “views”, it focuses on **meaningful, continuous watch time** and shows how that signal can drive trending boards and personalized algorithms.

This project is designed so you can experiment with:

1. **Heartbeat-based scoring (meaningful watch time)**
   - Use heartbeat events to award points only when a user has **continuously watched a video for at least _n_ seconds** (modeled here via playhead deltas and a score function).
   - The resulting scores can feed into **global rankings, “Trending Now” views, or per-user recommendation models**.

2. **High-RPS pipeline with Producer → Buffer → Consumer**
   - Inspired by OS schedulers, the system separates **producer (API) → in-memory buffer → consumer (Kafka workers)** for loose coupling.
   - This pattern lets the API stay responsive under high RPS while **batch workers handle heavy Redis/Kafka work** efficiently in the background.

3. **Simulation-driven, observable UI**
   - A NestJS **simulation service** generates traffic scenarios (bursts, spikes, steady load, etc.) so you can see how the system behaves.
   - A Next.js **dashboard** visualizes rankings, trending velocity, and pipeline health so you can **monitor the simulation and understand the impact of your changes at a glance**.

---

## Architecture Overview

The pipeline is: **API → Kafka → Worker → Redis → Ranking API → Dashboard**.

1. **API** — Clients (or the simulation service) send heartbeats to the Go API (`POST /v1/heartbeat`). The API validates the payload and publishes events to Kafka.
2. **Kafka** — Durable event log; decouples ingest from processing and allows multiple workers to consume in parallel.
3. **Worker** — Go consumers read batches from Kafka and run Redis Lua scripts to update global ranking and per-video velocity counters.
4. **Redis** — Stores sorted sets/counters for global ranking and trending velocity.
5. **Ranking API** — The same Go API serves `GET /v1/ranking` by reading from Redis.
6. **Dashboard** — Next.js app and simulation service drive scenarios and display rankings.

---

## System Architecture (ASCII)

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    CONTENTS RANKING PIPELINE                  │
                    └─────────────────────────────────────────────────────────────┘

  Clients / Sim          API                Kafka              Worker              Redis
  ┌──────────┐    POST /v1/heartbeat   ┌─────────┐      consume batch      ┌─────────────┐
  │ Dashboard │ ───────────────────►  │   Go    │ ──►  topic               │   Go        │
  │ or Sim   │                        │   API   │      video-heartbeats    │   Workers   │
  └──────────┘                        │  :8080  │  ◄── (batch size /       │  (scalable) │
        │                             └────┬────┘      flush interval)     └──────┬──────┘
        │                                  │ produce                               │
        │                                  ▼                                        │ Lua
        │                             ┌─────────┐                                   │ batch
        │                             │  Kafka  │                                   ▼
        │  GET /v1/ranking            │  :9092  │                            ┌─────────────┐
        └────────────────────────────│ 6 part.│                            │   Redis     │
                                     └─────────┘                            │   :6379     │
                                                                            │ ranking:    │
                                                                            │ global,     │
                                                                            │ velocity,   │
                                                                            │ trending    │
                                                                            └─────────────┘

  Observability:  Prometheus :9090  │  Grafana :3001  │  kafka-exporter :9308  │  redis-exporter :9121
```

### Data Flow

| Stage | Component | Role |
|-------|-----------|------|
| Ingest | Go API | Validates heartbeats, produces to Kafka (key: `session_id:video_id`) |
| Buffer | Kafka | Durable event log, 6 partitions; hash key spreads load, preserves per-session ordering |
| Process | Go Workers | Consume in batches, run Lua scripts (session + ranking + velocity) |
| Store | Redis | `ranking:global`, per-video velocity keys/counters, `ranking:trending` |
| Query | Go API | Serves `GET /v1/ranking` from Redis |
| Simulate | NestJS | Scenario factory (create, pause, resume, spike, stop) |
| Monitor | Prometheus + Grafana | Metrics and dashboards |

### Core Business Logic

- Each heartbeat carries `session_id`, `video_id`, `playhead` (ms), optional `user_id` and `timestamp`.
- The worker keeps an **in-memory** last-playhead map per `(session_id, video_id)` and computes `delta_ms = playhead - prev_playhead` (only if positive; clamped to 10s max).
- Scoring is continuous: `score_increment = delta_ms / 5000` (ms per ranking point), applied to Redis via `ZINCRBY ranking:global score_increment video_id`.
- **Trending velocity (60s window)**:
  - Hot path updates per-video keys: `ranking:velocity:<video_id>` (timestamped ZSET) + `ranking:velocity_count:<video_id>` (counter) and tracks active videos in `ranking:active_videos`.
  - A background task periodically recomputes `ranking:trending` from velocity counters by building `ranking:trending_tmp` and atomically renaming it to `ranking:trending`.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Kafka** | Decouples API from workers; durable replay; multiple partitions allow horizontal scaling of consumers. If workers are slow or down, events are buffered instead of dropped. |
| **Redis Lua scripts** | Ranking and velocity updates must be atomic for correctness under parallel workers. Lua runs inside Redis so one script sees a consistent view and avoids race conditions. |
| **Batch processing** | Workers consume up to N messages or flush on an interval, then run one Lua script per batch. Fewer Redis round-trips and better throughput; offsets are committed only after the batch succeeds so at-least-once semantics are preserved. |
| **Trending velocity** | To keep the heartbeat hot path fast, velocity is tracked with a timestamped ZSET plus a counter (`ranking:velocity_count:<video_id>`). The `ranking:trending` leaderboard is recomputed periodically from counters (atomic swap via `RENAME`) instead of being updated on every heartbeat. |

---

## Reliability Improvements

| Area | Implementation |
|------|----------------|
| **Worker failure handling** | If ProcessBatch or CommitMessages fails, the worker does not clear the in-memory batch or commit offsets. The worker exits so orchestration (e.g. Kubernetes) can restart it; the same batch is reprocessed. No silent message loss; no unbounded retry mixing new messages with the failed batch. |
| **Redis TTL cleanup** | Velocity keys (`ranking:velocity:<video_id>` and `ranking:velocity_count:<video_id>`) get EXPIRE (window_sec*2) on every write. Inactive videos' keys expire and no longer leak memory. |
| **Kafka partition strategy** | Message key is session_id:video_id. Ordering is preserved per session per video; traffic for a viral video is spread across partitions (different sessions → different keys) so no single partition becomes a hotspot. |
| **Input validation** | Heartbeat handler validates required fields before producing to Kafka: session_id and video_id non-empty (after trim), playhead ≥ 0, timestamp non-negative if present. Invalid requests receive HTTP 400 with a clear message and are never published. |
| **Observability** | Separate metrics for batch vs event: worker_batch_duration_seconds, worker_batch_size, worker_events_processed_total, worker_processing_duration_seconds (per-event, non-batch path). This avoids misreading batch latency as per-event latency in dashboards. |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **API & Workers** | Go, net/http, segmentio/kafka-go, go-redis |
| **Simulation** | NestJS, TypeScript |
| **Dashboard** | Next.js, React |
| **Message Queue** | Apache Kafka (KRaft mode) |
| **Storage** | Redis (sorted sets, counters/sets, Lua) |
| **Observability** | Prometheus, Grafana, kafka-exporter, redis-exporter |

---

## Quick Start

### Prerequisites

- **Docker Desktop** (Docker Compose included)

### Run

```bash
git clone <repo-url>
cd contents-ranking
make up
```

Wait ~30 seconds for Kafka and Redis to be ready, then open **http://localhost:3002**

```bash
make down     # Stop
make restart # Restart
```

All services (API, workers, simulation, dashboard, Kafka, Redis, Prometheus, Grafana) run in Docker. No `.env` required for the default setup.

### Environment (Optional)

For host-mode development, copy `.env.example` to `.env`. See `.env.example` for all variables.

Dashboard (optional):

- **`NEXT_PUBLIC_GO_API_URL`**: override dashboard Go API base (otherwise uses `/api/go` proxy)
- **`NEXT_PUBLIC_SIMULATION_URL`**: override dashboard Simulation base (otherwise uses `/api/sim` proxy)
- **`NEXT_PUBLIC_TRENDING_VELOCITY_THRESHOLD`**: only show trending items where `velocity >= threshold` (default `0`)

---

## Endpoints

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3002 |
| Go API | http://localhost:8080 |
| Ranking | http://localhost:8080/v1/ranking |
| Trending | http://localhost:8080/v1/ranking/trending |
| Ranking stats | http://localhost:8080/v1/ranking/stats |
| Simulation | http://localhost:3000/v1/factory/scenarios |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

---

## Performance

- **Kafka**: 6 partitions → parallel consumers
- **Workers**: `make up` starts with `--scale go-worker=3` (adjust in `Makefile` / `docker compose`)
- **Batch**: 50 events, 100ms flush → 1 Redis call per batch
- **Lua script**: Atomic batch processing in Redis

---

## Project Structure

```
contents-ranking/
├── cmd/
│   ├── api/           # Go API (heartbeat, ranking)
│   └── worker/        # Go Kafka consumer + batch processor
├── internal/
│   ├── config/        # Env-based configuration
│   ├── handler/       # HTTP handlers
│   ├── kafka/         # Producer, topic setup
│   ├── metrics/       # Prometheus metrics
│   ├── models/        # HeartbeatEvent
│   ├── redis/         # Redis client
│   ├── repository/    # Ranking repository (Redis seed)
│   └── worker/        # Consumer, processor, batch Lua
├── simulation-service/
│   ├── src/simulation/  # Factory, scenarios, events
│   ├── grafana/         # Dashboards
│   └── scripts/        # Load test
├── dashboard/
│   └── src/             # Next.js (ScenarioBuilder, RankingPanel, etc.)
├── monitoring/
│   └── prometheus.yml
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.worker
├── Makefile
└── .env.example
```
