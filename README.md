# BriefKlar

> AI assistant that explains German official letters (*Behördenbriefe*) in plain language:
> what the letter is about, what you need to do and by when.

## Features

- **Letter analysis with structured output:** upload a PDF or photo; the model reads it directly and
  answers with JSON validated against a Zod schema (sender, letter type, summary, tasks, amounts,
  reference numbers, deadline wording), with one repair round if the answer is invalid.
- **Deterministic deadline engine:** due dates are calculated by tested code, never by the model:
  delivery rules (§ 122 AO, § 41 VwVfG, § 37 SGB X), §§ 187, 188, 193 BGB, and the public holidays
  of every federal state. Each date comes with the steps that led to it.
- **Plain-language explanations** streamed over SSE in six languages: English, simple German,
  Turkish, Arabic, Ukrainian and Russian.
- **Reply drafts in German:** objection, extension request, cover letter, instalment plan or
  question, with a translation. BriefKlar only drafts; the user checks, signs and sends the letter.
- **Chat with tool calling and RAG:** questions about a letter are answered with tools for the
  analysis, the deadline engine, the holiday calendar, reminders and a pgvector knowledge base with
  official sources.
- **Reminders** for every deadline, plus the user's own.
- **Evaluation set** of 11 fictional letters that scores schema conformance, fields and deadlines.
- **Usage and cost dashboard** built from a log of every model call.
- **GDPR:** data export, account deletion and automatic deletion after a chosen period.
- **Accounts and a guest mode:** visitors can try one letter without an account.
- **Landing page and a fully translated site**, Arabic right to left.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query, React Router, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL 17 + pgvector, Prisma ORM |
| Background jobs | Redis + BullMQ (separate worker process) |
| Realtime | Server-Sent Events (SSE) |
| LLM | Claude Haiku 5.5 (Anthropic) with GPT-6 luna (OpenAI) as fallback and verifier, OpenAI embeddings, behind a provider-agnostic `LLMProvider` interface |
| Shared | `@briefklar/shared` — Zod schemas & types used by both API and web |
| Tests | Vitest, plus an evaluation set for the model's letter analysis |
| Deployment | Docker images, Docker Compose, Caddy (HTTPS, reverse proxy), GitHub Actions CI |

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) maps the folders and the files a request passes through.

```
React (Vite) ──HTTP──▶ Express API ──▶ PostgreSQL (Prisma)
     ▲                    │  │
     │ SSE (progress)     │  └─ enqueue ─▶ Redis (BullMQ) ─▶ Worker ──▶ Claude / OpenAI
     └────────────────────┘◀──── progress events ─────────────┘
```

- Uploads are validated by their **magic bytes**, not by the client-provided MIME type.
- Heavy work runs in a **separate worker process**, so the API stays responsive.
- The worker reports progress through BullMQ; the API forwards it to the browser over **SSE**.
- Plain-language explanations and chat answers are streamed over SSE as well, chunk by chunk while the model writes.
- The worker also runs a scheduled job (BullMQ job scheduler) that fires due reminders.
- File storage is one small class on the local disk (`lib/storage.ts`); an S3-compatible store would offer the same methods.

### How a letter is analyzed

1. The worker sends the PDF or photo directly to the model. Claude and GPT read documents and
   images natively, so there is no separate OCR step.
2. The model must answer with JSON that follows `LetterExtractionSchema` (a Zod schema in
   `packages/shared`, converted to JSON Schema for the API call).
3. The answer is validated with Zod. If it is invalid, the validation errors are sent back to the
   model once so it can repair its answer.
4. Every call is logged to the `LlmCall` table (model, prompt version, tokens, estimated cost, latency, success).
   When the primary provider is overloaded or times out and the fallback provider answers, the failed
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
  fallback provider takes over (only before the first chunk, so an answer is never mixed
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

The language picked in the globe menu of the header (or in the settings) applies to the whole site:
English, simple German, Turkish, Arabic (right to left), Ukrainian or Russian. A first-time visitor
gets the browser's language when it is one of these; the choice is kept in the browser.

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
  embeds them with OpenAI's `text-embedding-3-small` (1536 dimensions, normalized) into a pgvector column.
  Only new or changed entries are embedded again; a hash of text, source and model decides.
- A question is embedded as a query and compared by cosine distance (`<=>`). Matches below a
  similarity threshold are left out, so an unrelated question finds nothing instead of noise.
- The entries are English; the embedding model is multilingual, so questions in Turkish, Arabic,
  Ukrainian, Russian or German find the same entries.
- With a few dozen entries an exact scan is fast and never misses a match, so there is no vector
  index yet. An HNSW index is the next step when the base grows.

### Chat with tool calling

Each letter has a chat. The model (function calling) decides which tools to call; the
tools run in the API with checked code and data, and their results go back to the model until
it answers:

| Tool | What it does |
|---|---|
| `get_letter_details` | The analysis: sender, amounts, tasks, and deadlines already calculated by the deadline engine |
| `search_knowledge_base` | Semantic search in the knowledge base (RAG), with sources |
| `calculate_deadline` | The deadline engine for any German wording, also "what if it arrived on ..." |
| `check_date` / `list_public_holidays` | The holiday calendar of the user's federal state |
| `list_reminders` / `create_reminder` | Reminders for this letter; days are counted back in code |

- The loop is provider-neutral (`apps/api/src/chat/runChat.ts`); `chatRound` of each provider maps
  it to Claude's or OpenAI's tool calls. Arguments are validated with Zod; invalid arguments and unknown tools go back to
  the model as errors. After five tool rounds the model must answer.
- The model never calculates a date, holiday or legal rule from memory: the prompt requires the
  tools, and the answer shows which tools ran and which sources it used.
- Answers stream over SSE (a POST read with `fetch`), with an event for each tool. They are written
  in the language chosen in the settings and stored with the tools used and the sources.
- Each round is a logged model call. Claude gets its own turns back unchanged, thinking blocks
  included; after a switch to the other provider, tool calls without an id get one.
- Text from the letter and tool results is treated as data, not as instructions.

### Reminders

- Every upcoming deadline gets a reminder three days before its due date (or at once if it is
  closer). Reminders follow recalculated deadlines and keep their state when the date stays the same.
- Users add their own reminders on the reminders page, or ask the chat ("remind me two days before").
- A BullMQ job scheduler in the worker fires due reminders every five minutes; the header shows how
  many are due. This job is where e-mail or push delivery plugs in.

### Evaluation of the letter analysis

`apps/api/src/evals` holds 11 fictional letters (tax office, Jobcenter, broadcasting fee, child benefit,
immigration office, health insurer, landlord, employer, court payment order, phone bill and a private
invitation) with the values a correct analysis must contain.

```bash
npm run eval -w @briefklar/api                                   # the configured model, no fallback
npm run eval -w @briefklar/api -- --provider openai              # GPT-6 luna
npm run eval -w @briefklar/api -- --with-fallback --only 01,09   # production setup, two letters
```

- **Schema conformance**: was the answer valid at once, valid after the repair round, still invalid, or
  missing (timeout, overload)?
- **Field accuracy**: sender type, letter type, letter date, objection possible, amounts, reference
  numbers, and the deadlines. Only fields with one right answer are scored; urgency and the wording of
  the summary are not.
- Deadlines are scored end to end: the deadline engine computes due dates from the wording the model
  copied, as in the worker, and they are compared with the legally correct dates. A due date that is
  not expected counts as its own error, because a wrong date is worse than a missing one.
- By default one model answers every letter (no fallback), so a run measures that model. In development
  the primary model often timed out on the free tier and the fallback answered instead; `--with-fallback` shows which
  model answered each letter, and comparing two runs shows what the fallback costs in accuracy.
- Reports (Markdown and JSON) go to `apps/api/eval-results/`, which is not committed. Runs are logged
  as `eval-extract-letter` calls, so they appear in the cost dashboard.
- The letters are plain text sent like an uploaded file. Scans and PDFs (`.pdf`, `.jpg`, `.png`) can be
  added to `letters/` with a case in `cases.ts`; keep real letters out of the repository.

### Usage and cost dashboard

The *Usage* page reads the per-call log (`GET /api/usage?days=7|30|90`):

- Estimated cost, calls and failures, switches to the fallback model, average cost per letter, median
  and 95th percentile response time, tokens.
- Cost per day, and tables per task (analysis, translation, explanation, reply draft, chat, knowledge
  base) and per model.
- The latest failures with the provider's error, marked when the fallback model answered.

Costs come from a price table (`apps/api/src/llm/pricing.ts`, paid-tier prices per million tokens, thinking
tokens billed as output) and are stored with every call. Development runs on the free tier, so they show
what the same use would cost on the paid tier. After changing prices, `npm run llm:reprice -w @briefklar/api`
recalculates the logged calls. Embedding calls report no token counts and are counted as free.
Each user sees the calls made for their own letters; every logged call stores the owner of its letter.

### Landing page

Visitors who are not signed in see a landing page: what BriefKlar does, an example of an analyzed
letter, how it works in three steps, the features, the supported languages and how letters are kept
private. It leads to trying one letter as a guest or creating an account; signed-in users go straight
to the upload page.

### Accounts

Users sign up with an e-mail address and a password, and only ever see their own letters, chats,
reminders, settings and usage.

- Passwords are hashed with **scrypt** from Node's `crypto` module (memory-hard, no native dependency).
- Sessions are rows in the database. The browser gets a random token in an `httpOnly`, `SameSite=Lax`
  cookie (`Secure` in production); only the token's SHA-256 hash is stored. Signing out, changing the
  password (which signs out the other devices) or deleting the account ends sessions at once, which a
  stateless JWT could not do.
- Every route under `/api` except health, sign-up and sign-in needs a session, and every query is
  scoped to the signed-in user.
- **Guests** can try BriefKlar without an account: the first upload starts a guest session (a user
  without an e-mail address), and the guest sees the analysis of that one letter. My letters, the
  explanation, the chat, reply drafts, reminders, usage and the profile show a sign-in card; the API
  answers `403 ACCOUNT_REQUIRED`. Signing up turns the guest into the account, signing in moves the
  guest's letter to the account. Guests are deleted after 7 days, and one IP address can start
  10 guest sessions per hour.
- An unknown e-mail and a wrong password get the same answer in the same time; after 10 failed
  sign-ins for one address, further attempts are refused for 15 minutes.
- The profile page shows the account (e-mail, name, password) together with the settings and the
  data protection options below.

Before accounts, every letter belonged to one demo user. After signing up, an existing database hands
those letters to the new account with `npm run demo:claim -- you@example.com`.

### Data protection (GDPR)

Letters contain personal data, so users control what is kept and for how long.

- **Access and portability (Art. 15, 20):** *Profile → Download my data* returns one JSON file with the
  account, the settings, every letter with its original file (base64), analyses, translations, explanations,
  deadlines, tasks, reply drafts, chat and reminders, and which AI calls processed each letter.
- **Erasure (Art. 17):** *Delete my account* removes the account with every letter, file, queue job,
  reminder, setting and session.
  The API asks for an explicit `{ "confirm": "DELETE" }`. Logged AI calls stay for cost statistics, without
  the link to a letter; they hold no letter content.
- **Storage limitation (Art. 5 (1) e):** users can have letters deleted 30, 90, 180 or 365 days after
  upload. A scheduled worker job checks every hour and deletes the letter with everything that belongs to it.
- **Transparency:** the profile page says that letters are sent to the APIs of Anthropic (Claude) and
  OpenAI for analysis: one reads the letter, the other checks the analysis.
- Both APIs do not train on API data by default. An app offered to users in the EU still needs a data
  processing agreement with both providers before it handles real letters.

## Getting started

Requirements: Node.js 20+, Docker Desktop.

```bash
# 1. Install dependencies (all workspaces)
npm install

# 2. Start PostgreSQL (port 5433) and Redis (port 6380)
npm run infra:up

# 3. Configure the API: add ANTHROPIC_API_KEY (Claude analyses) and OPENAI_API_KEY (fallback,
#    verifier and embeddings); see the comments in the file
cp apps/api/.env.example apps/api/.env

# 4. Create the database schema (Prisma asks for a migration name, e.g. "init")
npm run db:migrate

# 5. Fill the knowledge base for the chat (one embedding request for 25 short texts)
npm run knowledge:seed -w @briefklar/api

# 6. Start API, worker and web app together
npm run dev
```

Open http://localhost:5173, create an account and upload a PDF or image.
API health check: http://localhost:4000/api/health

## Testing and evaluation

```bash
npm run typecheck                     # all workspaces
npm test                              # Vitest unit tests (no database or model needed)
npm run eval -w @briefklar/api        # evaluation of the letter analysis (calls the model)
npm run eval -w @briefklar/api -- --provider anthropic   # the same with another provider
```

The unit tests cover the deadline engine (periods, delivery rules, holidays per federal state),
German date parsing, reply letter composition, the chat tools and more. GitHub Actions runs the
typecheck, the tests and the builds on every push. See
[Evaluation of the letter analysis](#evaluation-of-the-letter-analysis) for the eval options.

## Deployment

One host with Docker runs everything: PostgreSQL, Redis, a one-off migration job, the API, the worker and
Caddy, which serves the web app, proxies `/api` (with SSE streaming), and gets an HTTPS certificate.

```bash
cp deploy/.env.production.example deploy/.env.production   # domain, database password, API key
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production run --rm api npm run knowledge:seed
```

- The API and the worker share one image (`apps/api/Dockerfile`); migrations run with
  `prisma migrate deploy` before either starts.
- Visitors sign up with their own account (see [Accounts](#accounts)); the session cookie is marked
  `Secure`, so production needs HTTPS.
- Uploaded letters live in a Docker volume; the database and Redis are not reachable from outside.
- GitHub Actions typechecks, tests, builds the web app and both images on every push.

## Monorepo layout

```
apps/
  api/        Express API + BullMQ worker + Prisma schema
  web/        React frontend
packages/
  shared/     Zod schemas and TypeScript types shared by api and web
```

## Disclaimer

BriefKlar does not provide legal advice.
