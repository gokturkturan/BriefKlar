# Architecture: where the code lives

A map for reading the code. The README explains *what* BriefKlar does; this file shows *where*
each part is and which files a request passes through.

## Folders of the API (`apps/api/src`)

Each feature keeps its HTTP routes, its logic and its model call (with the prompt) in one folder.
Shared building blocks live in `llm/`, `deadlines/` and `lib/`.

| Folder | What is in it |
| --- | --- |
| `auth/` | Sign-up, sign-in, guest, sign-out, profile and password routes; scrypt hashing (`password.ts`), database sessions and the cookie (`sessions.ts`), the middleware that requires a session or an account (`requireUser.ts`), rate limits, and moving a guest's letters to an account (`moveUserData.ts`) |
| `agents/` | The orchestrator and the agents that analyse a letter (intake, extractor, verifier, deadline, translator) or write a reply (reply writer, its verifier, research), the messages between them and where they are stored |
| `documents/` | Upload, list, delete; the BullMQ queue, the worker job (`processDocument.ts`), the letter analysis prompt (`extractLetter.ts`) and progress events over SSE |
| `explanation/` | Plain-language explanation: route, prompt, and the checked facts the model gets |
| `translation/` | The analysis texts in the reader's language, translated once and cached |
| `replies/` | Reply drafts: the model writes the body (`draftReply.ts`), another checks it (`verifyReply.ts`, `replyFacts.ts`), `composeReplyLetter.ts` builds the letter around it |
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
   `briefklar_session` cookie, looks up the `Session` row and sets `req.userId` (and `req.isGuest` for a
   guest, a user without an e-mail address).
2. `app.ts` mounts the public routes first (`/api/health`, `/api/auth`), then `requireUser`, which answers
   401 for everything else when there is no session. Features guests cannot use are mounted behind
   `requireAccount` (403 `ACCOUNT_REQUIRED`).
3. Routes read the user with `getUserId(req)` and put it into every query; letters are loaded through
   `documents/ownedDocument.ts`, which only finds the user's own. The worker gets a document id and reads
   the owner from the letter.
4. In the browser, `hooks/useAccount.ts` asks `GET /api/auth/me`. `App.tsx` shows the pages that need an
   account as `components/SignInRequired.tsx` to visitors and guests; the upload page starts a guest
   session (`POST /api/auth/guest`) with the first letter.

### The `llm/` folder

| File | Role |
| --- | --- |
| `LLMProvider.ts` | The provider-neutral interface. Nothing outside `llm/` imports a vendor SDK. |
| `ClaudeProvider.ts` | The Claude implementation (Anthropic API, Claude Haiku 5.5 by default): JSON answers, streamed text, chat rounds with tools; no embeddings |
| `OpenAIProvider.ts` | The OpenAI implementation (Chat Completions, GPT-6 luna by default) and OpenAI embeddings |
| `ProviderFallback.ts` | Puts the configured providers behind one: `LLM_PROVIDER` answers, `LLM_FALLBACK_PROVIDER` takes over when it is down, `LLM_EMBEDDING_PROVIDER` embeds |
| `fallback.ts` | Circuit breaker: when the primary model is overloaded, the fallback model answers for a while |
| `generateStructured.ts` | Asks for JSON, validates it with Zod, and lets the model repair an invalid answer once |
| `streamText.ts` | Streams free text (the explanation) |
| `logCall.ts` | `loggedCall()` writes every model request to the `LlmCall` table with tokens, cost and latency |
| `pricing.ts` | Price table for the cost estimate |
| `errors.ts` | `LLMError`: one error type for all providers, with a code the web app translates |
| `index.ts` | The `llm` instance the app uses, built from the `LLM_*` settings |

## The path of an uploaded letter

1. `documents/documentRoutes.ts` (`POST /api/documents`) checks the file's magic bytes, stores it
   (`lib/storage.ts`), creates the `Document` row and puts a job on the queue (`documentQueue.ts`).
2. The worker (`worker.ts`) runs `documents/processDocument.ts`, which starts an agent run
   (`AgentRun`) and lets the orchestrator (`agents/orchestrator.ts`) carry out the plan in
   `agents/analyseLetter.ts`:
   - The **intake agent** (`agents/intakeAgent.ts`) sorts the upload with one short request
     (`documents/classifyLetter.ts`): official letter or not, type, language, scan quality. An
     unreadable scan ends the run (`SCAN_UNREADABLE`). For a document that is not an official
     letter it writes a short analysis itself, and the plan goes straight to the deadline agent;
     the extractor and the verifier never run. The scan quality is stored on the `Document`, so the
     page can warn about a poor scan. `POST /api/documents/:id/retry` with `{ "skipIntake": true }`
     runs the plan without the intake agent (the page's "analyse in full" button).
   - The **extractor** (`agents/extractorAgent.ts`) runs `extractLetter.ts`, which sends the file to
     the model through `llm/generateStructured.ts` → `ProviderFallback.generateJson` → `ClaudeProvider` (or `OpenAIProvider` when Claude is down).
     Every attempt is logged by `llm/logCall.ts`, with the run and the agent.
   - The **verifier** (`agents/verifierAgent.ts`) sends the file and the analysis to another model
     (`documents/verifyExtraction.ts`, `verifierLlm` in `llm/index.ts`). Errors it can prove come
     back as a `revise` message; the orchestrator gives them to the extractor as notes for one
     correction round (`extractLetter.ts` with a revision) and lets the verifier check again.
     Fields still disputed are added to `uncertainFields`. The plan is `extractAndVerify` in
     `agents/analyseLetter.ts`.
   - The **deadline agent** (`agents/deadlineAgent.ts`, no AI) turns the deadline wording into due
     dates (`deadlines/deadlineRows.ts`) and stores the analysis, action items, deadlines and
     deadline reminders in one transaction. When a due date had to be estimated because the user
     has not entered the day the letter arrived (or their federal state), it also asks the user
     (`agents/userQuestion.ts`): the run then waits, and the page shows the question as a card.
   - The **translator** (`agents/translatorAgent.ts`) translates the analysis into the user's
     language (`translation/analysisTranslations.ts`).
   - Each step is reported as job progress, with the agent that runs it. A run that waits for the
     user ends its job with `{ status: "DONE", phase: "waitingForUser", question }`.
   - The answer (`POST /api/documents/:id/question`, `documents/answerQuestion.ts`) is stored where
     the deadline engine reads it, and `agents/resumeRun.ts` goes on with the same run: it reads
     the stored messages, records the answer as a message from `user`, and the plan starts again
     at the deadline agent. Entering the date in the old form or the state in the profile answers
     the question in the same way.

### How the agents talk

Agents never call each other. The orchestrator gives an agent a task and gets its reply; both are
stored as `AgentMessage` rows (schema: `AgentMessageSchema` in `packages/shared/src/agents.ts`).
Large data (the file, the analysis) stays in the run's case file (`agents/documentCaseFile.ts`), a
message only says what was asked or what changed. A run stops after `MAX_AGENT_HOPS` messages or
`MAX_LLM_CALLS_PER_RUN` model requests. An agent that needs something only the user knows answers with a
`question`; the orchestrator lets the plan finish, keeps at most one question per run
(`MAX_USER_QUESTIONS_PER_RUN`) and leaves the run `WAITING_FOR_USER`. The development overview (`/api/debug/overview`) shows the
latest runs with their messages in order.
3. `documents/documentEvents.ts` passes the progress from Redis to `GET /api/documents/:id/events`,
   which streams it to the browser (`apps/web/src/hooks/useDocumentEvents.ts`).

## The path of a chat question

1. `chat/chatRoutes.ts` (`POST /api/documents/:id/chat`) loads the analysis, deadlines and the
   last messages, and opens an SSE stream (`lib/sse.ts`).
2. `chat/runChat.ts` sends the conversation and the tool declarations to the model
   (`chatRound` of the configured provider). When the model asks for tools, `chat/tools.ts` runs them (deadline
   engine, holiday calendar, knowledge base search, reminders) and sends the results back, until
   the model answers with text.
3. Tool activity and text chunks go to the browser as they arrive (`apps/web/src/hooks/useChat.ts`);
   the question and the answer are stored together at the end.

### A reply draft from the chat

1. The model calls the `delegate` tool with `agent: "replyWriter"`, the kind of reply and the
   user's words as notes. `chat/delegateReply.ts` runs `agents/writeReply.ts`, the same plan the
   reply panel (`POST /api/documents/:id/reply-drafts`) uses:
   - A `CHAT` run starts with a `handoff` message from the chat to the reply writer.
   - The **reply writer** (`agents/replyWriterAgent.ts`) asks first when the notes lack what only
     the user knows (`replies/replyNotes.ts`, code, no model): a `REPLY_NOTES` question, which the
     chat puts to the user in its answer. The run waits; the next `delegate` call for the same kind
     of reply is the answer, and the run goes on (one question per run).
   - Otherwise it writes the body. The **verifier** (`agents/replyVerifierAgent.ts`) compares
     every number with the analysis and the notes (`replies/replyFacts.ts`) and asks the verifier's
     model about invented names, events and reasons (`replies/verifyReply.ts`). Issues go back to
     the reply writer for one correction; numbers still without a source become placeholders.
   - The **research agent** (`agents/researchAgent.ts`) finds official sources about this kind of
     reply in the knowledge base.
2. The draft is stored in `ReplyDraft`; the chat message keeps its id (`ChatMessage.replyDraftId`).
3. While the agents work, the orchestrator reports each one (`onAgent`), and the chat streams it
   as an `agent` event; the page shows the steps and, under the answer, a link to the draft.

## The web app (`apps/web/src`)

| Folder | What is in it |
| --- | --- |
| `pages/` | One component per route (landing page for visitors, sign-in and sign-up, upload, letters, letter detail, reminders, usage, profile) |
| `components/` | Panels of the letter page; `components/analysis/` holds the parts of the analysis panel |
| `hooks/` | The signed-in account, settings, and Server-Sent Events (progress, explanation, chat) |
| `api/client.ts` | Every API call and the TanStack Query keys |
| `i18n/` | Typed texts per language, plural rules, error texts |

`packages/shared` holds the Zod schemas and types both apps use, so a change to an API shape
shows up as a type error on both sides.
