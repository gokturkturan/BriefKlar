# Architecture: where the code lives

A map for reading the code. The README explains *what* BriefKlar does; this file shows *where*
each part is and which files a request passes through.

## Folders of the API (`apps/api/src`)

Each feature keeps its HTTP routes, its logic and its model call (with the prompt) in one folder.
Shared building blocks live in `llm/`, `deadlines/` and `lib/`.

| Folder | What is in it |
| --- | --- |
| `auth/` | Sign-up, sign-in, sign-out, profile and password routes; scrypt hashing (`password.ts`), database sessions and the cookie (`sessions.ts`), the middleware that requires a signed-in user (`requireUser.ts`), and the limit on failed sign-ins |
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
| `middleware/` | The JSON error handler and the 404 answer |
| `lib/` | Small helpers: Prisma, Redis, storage, SSE, HTTP errors, German date parsing |
| `evals/` | Evaluation set of sample letters and its scoring |
| `scripts/` | One-off commands (`npm run knowledge:seed`, `deadlines:recompute`, `llm:reprice`, `demo:claim`) |

`app.ts` mounts the routes, `server.ts` starts the API, `worker.ts` starts the worker process.

## Who is signed in

1. `auth/requireUser.ts` → `loadSession` runs for every `/api` request: it hashes the token from the
   `briefklar_session` cookie, looks up the `Session` row and sets `req.userId`.
2. `app.ts` mounts the public routes first (`/api/health`, `/api/auth`), then `requireUser`, which answers
   401 for everything else when nobody is signed in.
3. Routes read the user with `getUserId(req)` and put it into every query; letters are loaded through
   `documents/ownedDocument.ts`, which only finds the user's own. The worker gets a document id and reads
   the owner from the letter.
4. In the browser, `hooks/useAccount.ts` asks `GET /api/auth/me`. Without an account, `App.tsx` only has
   the sign-in and sign-up routes; any 401 later on (`main.tsx`) shows the sign-in page again.

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
| `pages/` | One component per route (sign-in and sign-up, upload, letters, letter detail, reminders, usage, profile) |
| `components/` | Panels of the letter page; `components/analysis/` holds the parts of the analysis panel |
| `hooks/` | The signed-in account, settings, and Server-Sent Events (progress, explanation, chat) |
| `api/client.ts` | Every API call and the TanStack Query keys |
| `i18n/` | Typed texts per language, plural rules, error texts |

`packages/shared` holds the Zod schemas and types both apps use, so a change to an API shape
shows up as a type error on both sides.
