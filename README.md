# BriefKlar

> AI assistant that explains German official letters (*Behördenbriefe*) in plain language:
> what the letter is about, what you need to do and by when.

**Status:** 🚧 Work in progress — week 3 (deterministic deadline engine with tests).

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query, React Router, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL 17 + pgvector, Prisma ORM |
| Background jobs | Redis + BullMQ (separate worker process) |
| Realtime | Server-Sent Events (SSE) |
| LLM | Google Gemini via `@google/genai`, behind a provider-agnostic `LLMProvider` interface |
| Shared | `@briefklar/shared` — Zod schemas & types used by both API and web |
| Tests | Vitest |

## Architecture

```
React (Vite) ──HTTP──▶ Express API ──▶ PostgreSQL (Prisma)
     ▲                    │  │
     │ SSE (progress)     │  └─ enqueue ─▶ Redis (BullMQ) ─▶ Worker ──▶ Gemini
     └────────────────────┘◀──── progress events ─────────────┘
```

- Uploads are validated by their **magic bytes**, not by the client-provided MIME type.
- Heavy work runs in a **separate worker process**, so the API stays responsive.
- The worker reports progress through BullMQ; the API forwards it to the browser over **SSE**.
- File storage sits behind a `StorageService` interface (local disk today, S3-compatible later).

### How a letter is analyzed

1. The worker sends the PDF or photo directly to the model. Gemini reads documents natively,
   so there is no separate OCR step.
2. The model must answer with JSON that follows `LetterExtractionSchema` (a Zod schema in
   `packages/shared`, converted to JSON Schema for the API call).
3. The answer is validated with Zod. If it is invalid, the validation errors are sent back to the
   model once so it can repair its answer.
4. Every call is logged to the `LlmCall` table (model, prompt version, tokens, latency, success).
5. The model never calculates dates: it only copies deadline wording from the letter.
   Due dates are decided by deterministic, tested code (see below).

### How deadlines are calculated

Code in `apps/api/src/deadlines` turns the deadline wording into a due date:

1. A date written in the wording (`bis zum 31.08.2026`) is used as is. The model's date is
   only accepted if it literally appears in the text.
2. Relative wording such as `innerhalb eines Monats nach Bekanntgabe` or `binnen 14 Tagen` is
   parsed into a period (days, weeks, months, years) and a start event (delivery, formal
   delivery or the letter date). Unclear wording (working days, several periods, "eine Woche
   vor dem Termin") gets no date instead of a guess.
3. For letters from authorities, delivery by post is assumed on the 4th day after the letter
   date (3rd day before 2025), moved to the next working day if needed
   (§ 122 AO, § 41 VwVfG, § 37 SGB X). For other senders the letter date is used, so the
   result is never later than the real deadline.
4. The period is counted with §§ 187, 188 BGB (31 January + 1 month = 28/29 February), and a
   deadline ending on a weekend or public holiday moves to the next working day (§ 193 BGB).
   Public holidays are computed for every federal state, Easter-based ones included. The
   user's state is not known yet, so only nationwide holidays are applied, and the UI notes
   when the due date is a holiday in some states.
5. Every computed deadline is stored with an "estimated" flag and the calculation steps,
   which the UI shows next to the date.

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

# 3. Configure the API (add your GEMINI_API_KEY from https://aistudio.google.com)
cp apps/api/.env.example apps/api/.env

# 4. Create the database schema (Prisma asks for a migration name, e.g. "init")
npm run db:migrate

# 5. Start API, worker and web app together
npm run dev
```

Open http://localhost:5173 and upload a PDF or image.
Run the tests with `npm test`.
API health check: http://localhost:4000/api/health

## Roadmap

- [x] Week 1 — Monorepo, Docker Compose, Prisma schema, upload, queue, SSE progress
- [x] Week 2 — LLM structured extraction (validated with Zod), action items, explicit deadlines
- [x] Week 3 — Deterministic deadline engine + tests, action items
- [ ] Week 4 — Streaming plain-language explanation, reply drafts in German
- [ ] Week 5 — Knowledge base (pgvector RAG), chat with tool calling, reminders
- [ ] Week 6 — Evaluation set, cost dashboard, GDPR features, deployment

## Notes on data protection

Letters contain personal data. Under the Gemini API terms, users in the EEA, Switzerland and the
UK get the paid-tier data terms even on the free quota, but an app offered to users in these
regions must use the paid tier. The free tier is used here for development only.

## Disclaimer

BriefKlar does not provide legal advice.
