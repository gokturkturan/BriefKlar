# BriefKlar

> AI assistant that explains German official letters (*Behördenbriefe*) in plain language:
> what the letter is about, what you need to do and by when.

**Status:** 🚧 Work in progress — week 1 (project skeleton, upload, background processing, live progress).

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query, React Router, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL 17 + pgvector, Prisma ORM |
| Background jobs | Redis + BullMQ (separate worker process) |
| Realtime | Server-Sent Events (SSE) |
| Shared | `@briefklar/shared` — Zod schemas & types used by both API and web |

## Architecture

```
React (Vite) ──HTTP──▶ Express API ──▶ PostgreSQL (Prisma)
     ▲                    │  │
     │ SSE (progress)     │  └─ enqueue ─▶ Redis (BullMQ) ─▶ Worker ──▶ LLM (week 2)
     └────────────────────┘◀──── progress events ─────────────┘
```

- Uploads are validated by their **magic bytes**, not by the client-provided MIME type.
- Heavy work runs in a **separate worker process**, so the API stays responsive.
- The worker reports progress through BullMQ; the API forwards it to the browser over **SSE**.
- File storage sits behind a `StorageService` interface (local disk today, S3-compatible later).

## Monorepo layout

```
apps/
  api/        Express API + BullMQ worker + Prisma schema
  web/        React frontend
packages/
  shared/     Zod schemas and TypeScript types shared by api and web
```

## Getting started

Requirements: Node.js 20+, Docker Desktop.

```bash
# 1. Install dependencies (all workspaces)
npm install

# 2. Start PostgreSQL (port 5433) and Redis (port 6380)
npm run infra:up

# 3. Configure the API
cp apps/api/.env.example apps/api/.env

# 4. Create the database schema (Prisma asks for a migration name, e.g. "init")
npm run db:migrate

# 5. Start API, worker and web app together
npm run dev
```

Open http://localhost:5173 and upload a PDF or image.
API health check: http://localhost:4000/api/health

## Roadmap

- [x] Week 1 — Monorepo, Docker Compose, Prisma schema, upload, queue, SSE progress
- [ ] Week 2 — Text extraction + LLM structured extraction (validated with Zod)
- [ ] Week 3 — Deterministic deadline engine + tests, action items
- [ ] Week 4 — Streaming plain-language explanation, reply drafts in German
- [ ] Week 5 — Knowledge base (pgvector RAG), chat with tool calling, reminders
- [ ] Week 6 — Evaluation set, cost dashboard, GDPR features, deployment

## Disclaimer

BriefKlar does not provide legal advice.
