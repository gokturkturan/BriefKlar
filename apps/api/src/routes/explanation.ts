import { Router } from "express";
import {
  isExplanationLanguage,
  type ExplanationDto,
  type ExplanationLanguage,
  type ExplanationStreamEvent,
} from "@briefklar/shared";
import type { Explanation } from "@prisma/client";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm";
import { explainLetter } from "../llm/explainLetter";
import { EXPLAIN_LETTER_PROMPT_VERSION } from "../prompts/explainLetter";
import { storage } from "../storage";
import { findOwnedDocument, requireExtraction } from "./ownedDocument";

/** Mounted at /api/documents/:id/explanation */
export const explanationRouter = Router({ mergeParams: true });

function toDto(row: Explanation): ExplanationDto {
  return {
    language: row.language as ExplanationLanguage,
    content: row.content,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/documents/:id/explanation?language=tr
// Server-Sent Events: the explanation arrives in chunks while the model writes it.
// A finished explanation is stored, so the next request gets it at once.
explanationRouter.get("/", async (req, res) => {
  const language = req.query.language ?? "en";
  if (!isExplanationLanguage(language)) {
    throw new HttpError(400, "Unsupported language", "INVALID_LANGUAGE");
  }

  const doc = await findOwnedDocument(req);
  if (doc.status !== "DONE") throw new HttpError(409, "This letter has not been analyzed yet.", "NOT_ANALYZED");
  const extraction = await requireExtraction(doc.id);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders(); // the browser sees the stream open while the model is still thinking
  const send = (event: ExplanationStreamEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const cached = await prisma.explanation.findUnique({
    where: { documentId_language: { documentId: doc.id, language } },
  });
  if (cached) {
    send({ type: "done", explanation: toDto(cached) });
    res.end();
    return;
  }

  // Stop generating (and paying for tokens) when the user leaves the page
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abort.abort();
  });

  try {
    const [file, deadlines] = await Promise.all([
      storage.read(doc.fileKey),
      prisma.deadline.findMany({ where: { documentId: doc.id }, orderBy: { dueDate: "asc" } }),
    ]);

    const result = await explainLetter({
      documentId: doc.id,
      file,
      mimeType: doc.mimeType,
      extraction,
      deadlines,
      language,
      signal: abort.signal,
      onDelta: (text) => send({ type: "delta", text }),
    });

    const saved = await prisma.explanation.upsert({
      where: { documentId_language: { documentId: doc.id, language } },
      create: {
        documentId: doc.id,
        language,
        content: result.text.trim(),
        model: result.model,
        promptVersion: EXPLAIN_LETTER_PROMPT_VERSION,
      },
      update: { content: result.text.trim(), model: result.model, promptVersion: EXPLAIN_LETTER_PROMPT_VERSION },
    });
    send({ type: "done", explanation: toDto(saved) });
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error(`Explanation failed for ${doc.id}:`, err);
    const message =
      err instanceof LLMError ? err.userMessage : "The explanation could not be created. Please try again.";
    send({ type: "error", message });
  }
  res.end();
});
