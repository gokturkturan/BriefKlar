# BriefKlar

> AI assistant that explains German official letters (*Behördenbriefe*) in plain language:
> what the letter is about, what you need to do and by when.

**Status:** 🚧 Work in progress — week 5 done: knowledge base, chat with tool calling, reminders. Next: week 6.

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
- Plain-language explanations and chat answers are streamed over SSE as well, chunk by chunk while the model writes.
- The worker also runs a scheduled job (BullMQ job scheduler) that fires due reminders.
- File storage sits behind a `StorageService` interface (local disk today, S3-compatible later).

### How a letter is analyzed

1. The worker sends the PDF or photo directly to the model. Gemini reads documents natively,
   so there is no separate OCR step.
2. The model must answer with JSON that follows `LetterExtractionSchema` (a Zod schema in
   `packages/shared`, converted to JSON Schema for the API call).
3. The answer is validated with Zod. If it is invalid, the validation errors are sent back to the
   model once so it can repair its answer.
4. Every call is logged to the `LlmCall` table (model, prompt version, tokens, latency, success).
   When the primary model is overloaded or times out and the fallback model answers, the failed
   attempt is logged as its own row, so the log shows each switch and the time it cost.
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
   user's federal state (set in the settings) adds its regional holidays. Without it, only
   nationwide holidays are applied, and the UI notes when the due date is a holiday in some states.
5. Every computed deadline is stored with an "estimated" flag and the calculation steps.
   The steps are stored as typed data (`DeadlineStep`, holidays as ids), not as sentences,
   so the UI can show them in the reader's language. After a change to the rules or the
   stored format, `npm run deadlines:recompute -w @briefklar/api` recalculates every letter.
6. When the user enters the day the letter actually arrived, it replaces the assumed delivery
   date. Deadlines are then calculated again from the stored analysis, without another AI call.

### Plain-language explanation

`GET /api/documents/:id/explanation?language=tr` streams an explanation in one of six
languages (English, simple German, Turkish, Arabic, Ukrainian, Russian) over SSE.

- The model gets the letter plus the due dates from the deadline engine as checked facts, so
  it never calculates a date itself.
- The finished text is stored per language; the next request gets it at once. It is removed
  when the letter is analyzed again or a due date changes.
- Closing the page aborts the model call. If the model sends nothing for 20 seconds, the
  smaller fallback model takes over (only before the first chunk, so an answer is never mixed
  from two models).
- The text is rendered with React elements, never as HTML.

### Reply drafts in German

Users choose a reply type (objection, extension request, cover letter for documents,
instalment plan or question) and can add notes in their own language.

- The model writes only the body, in formal German, plus a translation into the user's
  language so they know what they sign.
- Code builds the letter around it: addresses, date, subject line, reference numbers copied
  from the analysis, greeting, closing and the list of attachments. Missing details are
  `[placeholders]`.
- Code picks *Einspruch* (tax and child benefit offices) or *Widerspruch* (other authorities).
- Warnings are computed when a draft is read: an objection deadline that has passed, a letter
  that mentions no right to object, placeholders still to fill in.

### The site in the reader's language

The language chosen in the settings (or in the header) applies to the whole site: English,
simple German, Turkish, Arabic (right to left), Ukrainian or Russian.

- The web app has typed messages per language in `apps/web/src/i18n`. Every language is typed
  against the English messages, so a missing text fails the build. Dates, amounts and plurals
  use the reader's locale (Arabic keeps Latin digits, as in the letters).
- The API sends data, not English sentences, for anything code decides: deadline steps, reply
  warnings and an `ErrorCode` with every error (also on failed letters and broken streams).
- The analysis is written in English once, so it stays stable for tests and evals. Its summary,
  actions, documents, amount purposes and reference labels are then translated and cached per
  analysis and language. The worker translates into the user's language right after the
  analysis; letters analyzed earlier, or opened after a language change, are translated on
  first view (`GET /api/documents/:id/translation?language=tr`), with the English text shown
  until then or if the translation fails.
- The translation schema pins every list to the length of the English one: an answer that
  merges or drops an item fails validation and goes back to the model, so a translated task
  never ends up next to the wrong checkbox.
- Source code, the README and commit messages stay in English.

### Knowledge base (RAG)

A curated knowledge base of 25 entries covers what people ask about German letters: Widerspruch
and Einspruch, delivery (Bekanntgabe, yellow envelope), counting deadlines, missed deadlines,
asking for more time or instalments, payment orders (Mahnbescheid), dismissals, tenancies,
benefits, residence permits and where to get advice. Every entry names an official source,
mostly the law on gesetze-im-internet.de.

- The entries live in `apps/api/src/knowledge/entries.ts`. `npm run knowledge:seed -w @briefklar/api`
  embeds them with `gemini-embedding-001` (1536 dimensions, normalized) into a pgvector column.
  Only new or changed entries are embedded again; a hash of text, source and model decides.
- A question is embedded as a query and compared by cosine distance (`<=>`). Matches below a
  similarity threshold are left out, so an unrelated question finds nothing instead of noise.
- The entries are English; the embedding model is multilingual, so questions in Turkish, Arabic,
  Ukrainian, Russian or German find the same entries.
- With a few dozen entries an exact scan is fast and never misses a match, so there is no vector
  index yet. An HNSW index is the next step when the base grows.

### Chat with tool calling

Each letter has a chat. The model (Gemini function calling) decides which tools to call; the
tools run in the API with checked code and data, and their results go back to the model until
it answers:

| Tool | What it does |
|---|---|
| `get_letter_details` | The analysis: sender, amounts, tasks, and deadlines already calculated by the deadline engine |
| `search_knowledge_base` | Semantic search in the knowledge base (RAG), with sources |
| `calculate_deadline` | The deadline engine for any German wording, also "what if it arrived on ..." |
| `check_date` / `list_public_holidays` | The holiday calendar of the user's federal state |
| `list_reminders` / `create_reminder` | Reminders for this letter; days are counted back in code |

- The loop is provider-neutral (`apps/api/src/chat/runChat.ts`); `GeminiProvider.chatRound` maps
  it to Gemini. Arguments are validated with Zod; invalid arguments and unknown tools go back to
  the model as errors. After five tool rounds the model must answer.
- The model never calculates a date, holiday or legal rule from memory: the prompt requires the
  tools, and the answer shows which tools ran and which sources it used.
- Answers stream over SSE (a POST read with `fetch`), with an event for each tool. They are written
  in the language chosen in the settings and stored with the tools used and the sources.
- Each round is a logged model call. Gemini's thought signatures are sent back with tool calls;
  after a switch to the fallback model, calls written by the other model get Gemini's placeholder.
- Text from the letter and tool results is treated as data, not as instructions.

### Reminders

- Every upcoming deadline gets a reminder three days before its due date (or at once if it is
  closer). Reminders follow recalculated deadlines and keep their state when the date stays the same.
- Users add their own reminders on the reminders page, or ask the chat ("remind me two days before").
- A BullMQ job scheduler in the worker fires due reminders every five minutes; the header shows how
  many are due. This job is where e-mail or push delivery plugs in once there are real accounts.

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

# 5. Fill the knowledge base for the chat (one embedding request for 25 short texts)
npm run knowledge:seed -w @briefklar/api

# 6. Start API, worker and web app together
npm run dev
```

Open http://localhost:5173 and upload a PDF or image.
Run the tests with `npm test`.
API health check: http://localhost:4000/api/health

## Roadmap

- [x] Week 1 — Monorepo, Docker Compose, Prisma schema, upload, queue, SSE progress
- [x] Week 2 — LLM structured extraction (validated with Zod), action items, explicit deadlines
- [x] Week 3 — Deterministic deadline engine + tests, action items
- [x] Week 4 — Streaming plain-language explanation, reply drafts in German, federal state and delivery date
- [x] The whole site in six languages (UI, analysis, deadline steps, errors), Arabic right to left
- [x] Week 5 — Knowledge base (pgvector RAG), chat with tool calling, reminders
- [ ] Week 6 — Evaluation set, cost dashboard, GDPR features, deployment

## Notes on data protection

Letters contain personal data. Under the Gemini API terms, users in the EEA, Switzerland and the
UK get the paid-tier data terms even on the free quota, but an app offered to users in these
regions must use the paid tier. The free tier is used here for development only.

## Disclaimer

BriefKlar does not provide legal advice.
