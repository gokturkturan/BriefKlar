import { Router } from "express";
import {
  isChatToolName,
  isExplanationLanguage,
  isGermanState,
  SendChatMessageSchema,
  type ChatMessageDto,
  type ChatSourceDto,
  type ChatStreamEvent,
  type ChatToolCallDto,
} from "@briefklar/shared";
import type { ChatMessage, Prisma } from "@prisma/client";
import { runChat } from "./runChat";
import { todayInGermany, toIsoDate } from "../deadlines/calendarDate";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { openSse } from "../lib/sse";
import { llm, LLMError } from "../llm";
import type { ChatTurn } from "../llm/LLMProvider";
import { chatSystemPrompt, chatTurnInstruction, CHAT_PROMPT_VERSION } from "./chatPrompt";
import { requireExtraction } from "../documents/extractions";
import { findOwnedDocument } from "../documents/ownedDocument";

/** Mounted at /api/documents/:id/chat */
export const chatRouter = Router({ mergeParams: true });

/** Earlier messages the model sees; older ones are left out to keep requests small */
const HISTORY_LIMIT = 20;

function toolCallsOf(value: Prisma.JsonValue | null): ChatToolCallDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const call = item as { name?: unknown; ok?: unknown } | null;
    return call && isChatToolName(call.name) ? [{ name: call.name, ok: call.ok !== false }] : [];
  });
}

function sourcesOf(value: Prisma.JsonValue): ChatSourceDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = item as { title?: unknown; url?: unknown } | null;
    return source && typeof source.title === "string" && typeof source.url === "string"
      ? [{ title: source.title, url: source.url }]
      : [];
  });
}

function toDto(row: ChatMessage): ChatMessageDto {
  return {
    id: row.id,
    role: row.role === "USER" ? "user" : "assistant",
    content: row.content,
    toolCalls: toolCallsOf(row.toolCalls),
    sources: sourcesOf(row.sources),
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/documents/:id/chat
chatRouter.get("/", async (req, res) => {
  const doc = await findOwnedDocument(req);
  const rows = await prisma.chatMessage.findMany({
    where: { documentId: doc.id, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "asc" },
  });
  res.json(rows.map(toDto));
});

// DELETE /api/documents/:id/chat  (start a new conversation)
chatRouter.delete("/", async (req, res) => {
  const doc = await findOwnedDocument(req);
  await prisma.chatMessage.deleteMany({ where: { documentId: doc.id } });
  res.status(204).end();
});

// POST /api/documents/:id/chat  { message }
// Answers with Server-Sent Events: tool activity, text chunks, then the stored messages.
// The question and the answer are stored together once the answer is complete.
chatRouter.post("/", async (req, res) => {
  const body = SendChatMessageSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid message", "INVALID_BODY");

  const doc = await findOwnedDocument(req);
  if (doc.status !== "DONE") throw new HttpError(409, "This letter has not been analyzed yet.", "NOT_ANALYZED");
  const extraction = await requireExtraction(doc.id);

  const [user, deadlines, actionItems, previous] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: doc.userId } }),
    prisma.deadline.findMany({ where: { documentId: doc.id }, orderBy: { dueDate: "asc" } }),
    prisma.actionItem.findMany({ where: { documentId: doc.id }, orderBy: { position: "asc" } }),
    prisma.chatMessage.findMany({
      where: { documentId: doc.id, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
  ]);
  // The chat answers in the language chosen in the settings
  const language = isExplanationLanguage(user.preferredLanguage) ? user.preferredLanguage : "en";
  const state = isGermanState(user.state) ? user.state : null;
  const today = todayInGermany();

  const history: ChatTurn[] = previous.reverse().map((row) => ({
    role: row.role === "USER" ? "user" : "model",
    parts: [{ type: "text", text: row.content }],
  }));

  // Stops the model and the tools when the user leaves the page
  const { send, signal } = openSse<ChatStreamEvent>(res);

  try {
    const answer = await runChat({
      provider: llm,
      system: chatSystemPrompt({ language, today, state }),
      promptVersion: CHAT_PROMPT_VERSION,
      history,
      message: body.data.message,
      instruction: chatTurnInstruction(language),
      context: {
        userId: doc.userId,
        documentId: doc.id,
        today,
        state,
        extraction,
        receivedDate: doc.receivedDate ? toIsoDate(doc.receivedDate) : null,
        deadlines,
        actionItems: actionItems.map(({ text, done }) => ({ text, done })),
        signal,
      },
      onEvent: send,
    });
    if (!answer.text) throw new LLMError("The model returned no text", true, "Empty answer", "AI_INCOMPLETE");

    // Explicit times keep the order: inside one transaction the database clock does not move
    const now = Date.now();
    const [userMessage, message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: { documentId: doc.id, role: "USER", content: body.data.message, createdAt: new Date(now) },
      }),
      prisma.chatMessage.create({
        data: {
          documentId: doc.id,
          role: "ASSISTANT",
          content: answer.text,
          toolCalls: answer.toolCalls as unknown as Prisma.InputJsonValue,
          sources: answer.sources as unknown as Prisma.InputJsonValue,
          model: answer.model,
          createdAt: new Date(now + 1),
        },
      }),
    ]);
    send({ type: "done", userMessage: toDto(userMessage), message: toDto(message) });
  } catch (err) {
    if (signal.aborted) return;
    console.error(`Chat failed for ${doc.id}:`, err);
    send(
      err instanceof LLMError
        ? { type: "error", message: err.userMessage, code: err.code }
        : { type: "error", message: "The assistant could not answer. Please try again.", code: "AI_FAILED" },
    );
  }
  res.end();
});
