# Architecture: where the code lives

A map for reading the code. The README explains *what* BriefKlar does; this file shows *where*
each part is and which files a request passes through.

## Folders of the API (`apps/api/src`)

Each feature keeps its HTTP routes, its logic and its model call (with the prompt) in one folder.
Shared building blocks live in `llm/`, `deadlines/` and `lib/`.

| Folder | What is in it |
| --- | --- |
| `documents/` | Upload, list, delete; the BullMQ queue, the worker job (`processDocument.ts`), the letter analysis prompt (`extractLetter.ts`) and progress events over SSE |
| `explanation/` | Plain-language explanation: route, prompt, and the checked facts the model gets |
| `translation/` | The analysis texts in the reader's language, translated once and cached |
| `replies/` | Reply drafts: the model writes the body, `composeReplyLetter.ts` builds the letter around it |
| `chat/` | Chat about a letter: route, prompt, tool loop (`runChat.ts`) and the tools (`tools.ts`) |
| `knowledge/` | Curated entries and pgvector search for the chat |
| `reminders/` | Reminders the user sets and the automatic ones for deadlines |
| `usage/` | The usage and cost dashboard |
| `privacy/` | Data export, account deletion, retention period |
| `settings/` | Language, federal state, retention period |
| `system/` | Health check and a development-only debug overview |
| `deadlines/` | The deterministic deadline engine (calendar, holidays, BGB rules). No AI. |
| `llm/` | Everything model-related that features share (see below) |
| `lib/` | Small helpers: Prisma, Redis, storage, SSE, HTTP errors, German date parsing |
| `evals/` | Evaluation set of sample letters and its scoring |
| `scripts/` | One-off commands (`npm run knowledge:seed`, `deadlines:recompute`, `llm:reprice`) |

`app.ts` mounts the routes, `server.ts` starts the API, `worker.ts` starts the worker process.

### The `llm/` folder

| File | Role |
| --- | --- |
| `LLMProvider.ts` | The provider-neutral interface. Nothing outside `llm/` imports a vendor SDK. |
| `GeminiProvider.ts` | The Gemini implementation: JSON answers, streamed text, chat rounds with tools, embeddings |
| `fallback.ts` | Circuit breaker: when the primary model is overloaded, the fallback model answers for a while |
| `generateStructured.ts` | Asks for JSON, validates it with Zod, and lets the model repair an invalid answer once |
| `streamText.ts` | Streams free text (the explanation) |
| `logCall.ts` | `loggedCall()` writes every model request to the `LlmCall` table with tokens, cost and latency |
| `pricing.ts` | Price table for the cost estimate |
| `errors.ts` | `LLMError`: one error type for all providers, with a code the web app translates |
| `index.ts` | The `llm` instance the app uses |

## The path of an uploaded letter

1. `documents/documentRoutes.ts` (`POST /api/documents`) checks the file's magic bytes, stores it
   (`lib/storage.ts`), creates the `Document` row and puts a job on the queue (`documentQueue.ts`).
2. The worker (`worker.ts`) runs `documents/processDocument.ts`:
   - `extractLetter.ts` sends the file to the model through `llm/generateStructured.ts`
     → `GeminiProvider.generateJson` → `fallback.ts`. Every attempt is logged by `llm/logCall.ts`.
   - `deadlines/deadlineRows.ts` turns the deadline wording into due dates (no AI).
   - Action items, deadlines and deadline reminders are stored in one transaction.
   - The analysis is translated into the user's language (`translation/analysisTranslations.ts`).
   - Each step is reported as job progress.
3. `documents/documentEvents.ts` passes the progress from Redis to `GET /api/documents/:id/events`,
   which streams it to the browser (`apps/web/src/hooks/useDocumentEvents.ts`).

## The path of a chat question

1. `chat/chatRoutes.ts` (`POST /api/documents/:id/chat`) loads the analysis, deadlines and the
   last messages, and opens an SSE stream (`lib/sse.ts`).
2. `chat/runChat.ts` sends the conversation and the tool declarations to the model
   (`GeminiProvider.chatRound`). When the model asks for tools, `chat/tools.ts` runs them (deadline
   engine, holiday calendar, knowledge base search, reminders) and sends the results back, until
   the model answers with text.
3. Tool activity and text chunks go to the browser as they arrive (`apps/web/src/hooks/useChat.ts`);
   the question and the answer are stored together at the end.

## The web app (`apps/web/src`)

| Folder | What is in it |
| --- | --- |
| `pages/` | One component per route (upload, letters, letter detail, reminders, usage, settings) |
| `components/` | Panels of the letter page; `components/analysis/` holds the parts of the analysis panel |
| `hooks/` | Server-Sent Events (progress, explanation, chat) and settings |
| `api/client.ts` | Every API call and the TanStack Query keys |
| `i18n/` | Typed texts per language, plural rules, error texts |

`packages/shared` holds the Zod schemas and types both apps use, so a change to an API shape
shows up as a type error on both sides.
