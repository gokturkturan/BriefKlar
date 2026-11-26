import { Router } from "express";
import type { ReplyDraft } from "@prisma/client";
import {
  CreateReplyDraftSchema,
  type ExplanationLanguage,
  type LetterExtraction,
  type ReplyDraftDto,
  type ReplyType,
} from "@briefklar/shared";
import { z } from "zod";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm";
import { draftReply } from "../llm/draftReply";
import { LLMValidationError } from "../llm/generateStructured";
import { REPLY_DRAFT_PROMPT_VERSION } from "../prompts/replyDraft";
import { composeReplyLetter, replyWarnings, todayInGermany } from "../replies/composeReplyLetter";
import { findOwnedDocument, requireExtraction, routeParam } from "./ownedDocument";

/** Mounted at /api/documents/:id/reply-drafts */
export const replyDraftsRouter = Router({ mergeParams: true });

type DeadlineDates = { kind: string; dueDate: string }[];

async function deadlineDates(documentId: string): Promise<DeadlineDates> {
  const rows = await prisma.deadline.findMany({ where: { documentId } });
  return rows.map((d) => ({ kind: d.kind, dueDate: d.dueDate.toISOString().slice(0, 10) }));
}

/** Warnings depend on today's date, so they are computed when a draft is read, not stored */
function toDto(row: ReplyDraft, extraction: LetterExtraction, deadlines: DeadlineDates): ReplyDraftDto {
  const type = row.type as ReplyType;
  return {
    id: row.id,
    type,
    contentDe: row.contentDe,
    contentUserLanguage: row.contentUserLanguage,
    language: row.language as ExplanationLanguage,
    notes: row.notes,
    warnings: replyWarnings({ type, extraction, deadlines, contentDe: row.contentDe, today: todayInGermany() }),
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/documents/:id/reply-drafts  -> newest first
replyDraftsRouter.get("/", async (req, res) => {
  const doc = await findOwnedDocument(req);
  const drafts = await prisma.replyDraft.findMany({
    where: { documentId: doc.id },
    orderBy: { createdAt: "desc" },
  });
  if (drafts.length === 0) {
    res.json([]);
    return;
  }
  const [extraction, deadlines] = await Promise.all([requireExtraction(doc.id), deadlineDates(doc.id)]);
  res.json(drafts.map((draft) => toDto(draft, extraction, deadlines)));
});

// POST /api/documents/:id/reply-drafts  { type, notes?, language? }
replyDraftsRouter.post("/", async (req, res) => {
  const body = CreateReplyDraftSchema.safeParse(req.body);
  if (!body.success) {
    throw new HttpError(400, body.error.issues[0]?.message ?? "Invalid request", "INVALID_BODY");
  }
  const { type, notes, language } = body.data;

  const doc = await findOwnedDocument(req);
  const extraction = await requireExtraction(doc.id);

  let result;
  try {
    result = await draftReply({ documentId: doc.id, type, extraction, notes, language });
  } catch (err) {
    if (err instanceof LLMError) throw new HttpError(503, err.userMessage, err.code);
    if (err instanceof LLMValidationError) {
      throw new HttpError(502, "The AI returned an incomplete draft. Please try again.", "AI_INCOMPLETE");
    }
    throw err;
  }

  const contentDe = composeReplyLetter({ type, extraction, body: result.data, date: todayInGermany() });
  const draft = await prisma.replyDraft.create({
    data: {
      documentId: doc.id,
      type,
      contentDe,
      contentUserLanguage: result.data.translation.trim(),
      language,
      notes,
      model: result.model,
      promptVersion: REPLY_DRAFT_PROMPT_VERSION,
    },
  });

  res.status(201).json(toDto(draft, extraction, await deadlineDates(doc.id)));
});

const UpdateReplyDraftSchema = z.object({ contentDe: z.string().trim().min(1).max(20_000) });

// PATCH /api/documents/:id/reply-drafts/:draftId  { contentDe }  -> keeps the user's own edits
replyDraftsRouter.patch("/:draftId", async (req, res) => {
  const body = UpdateReplyDraftSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Expected { contentDe: string }", "INVALID_BODY");

  const doc = await findOwnedDocument(req);
  const result = await prisma.replyDraft.updateMany({
    where: { id: routeParam(req, "draftId"), documentId: doc.id },
    data: { contentDe: body.data.contentDe },
  });
  if (result.count === 0) throw new HttpError(404, "Draft not found", "DRAFT_NOT_FOUND");
  res.status(204).end();
});

// DELETE /api/documents/:id/reply-drafts/:draftId
replyDraftsRouter.delete("/:draftId", async (req, res) => {
  const doc = await findOwnedDocument(req);
  const result = await prisma.replyDraft.deleteMany({
    where: { id: routeParam(req, "draftId"), documentId: doc.id },
  });
  if (result.count === 0) throw new HttpError(404, "Draft not found", "DRAFT_NOT_FOUND");
  res.status(204).end();
});
