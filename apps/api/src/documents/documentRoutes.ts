import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import type { ActionItem, Deadline, Document, Extraction } from "@prisma/client";
import { z } from "zod";
import {
  GUEST_MAX_LETTERS,
  isErrorCode,
  isTerminalStatus,
  parseDeadlineSteps,
  UPLOAD_LIMITS,
  UpdateDocumentSchema,
  type AcceptedMimeType,
  type DocumentDetailDto,
  type DocumentDto,
  type LetterAnalysisDto,
  type ProgressEvent,
} from "@briefklar/shared";
import { prisma } from "../lib/prisma";
import { openSse } from "../lib/sse";
import { latestExtraction, letterOf } from "./extractions";
import { HttpError } from "../lib/httpError";
import { detectFileType } from "./fileType";
import { storage } from "../lib/storage";
import { recomputeDeadlines } from "../deadlines/recomputeDeadlines";
import { isIsoDate, todayInGermany } from "../deadlines/calendarDate";
import { documentQueue, enqueueDocument } from "./documentQueue";
import { isProgressEvent, subscribeToDocument } from "./documentEvents";
import { getUserId } from "../auth/requireUser";
import { deleteDocuments } from "../privacy/userData";
import { findOwnedDocument, routeParam } from "./ownedDocument";

export const documentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.maxBytes, files: 1 },
});

function toDto(doc: Document): DocumentDto {
  return {
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType as AcceptedMimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    errorMessage: doc.errorMessage,
    errorCode: isErrorCode(doc.errorCode) ? doc.errorCode : null,
    receivedDate: doc.receivedDate ? doc.receivedDate.toISOString().slice(0, 10) : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

function toAnalysisDto(
  extraction: Extraction | undefined,
  actionItems: ActionItem[],
  deadlines: Deadline[],
): LetterAnalysisDto | null {
  if (!extraction) return null;
  const letter = letterOf(extraction);
  if (!letter) return null;

  return {
    extraction: letter,
    model: extraction.model,
    promptVersion: extraction.promptVersion,
    createdAt: extraction.createdAt.toISOString(),
    actionItems: actionItems.map(({ id, text, done }) => ({ id, text, done })),
    deadlines: deadlines.map((d) => ({
      id: d.id,
      dueDate: d.dueDate.toISOString().slice(0, 10),
      kind: d.kind,
      sourceText: d.sourceText,
      isEstimate: d.isEstimate,
      steps: parseDeadlineSteps(d.steps),
    })),
  };
}

// POST /api/documents  (multipart/form-data, field name: "file")
documentsRouter.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'No file uploaded (expected field "file").', "NO_FILE");

  const detected = detectFileType(file.buffer);
  if (!detected) {
    throw new HttpError(415, "Only PDF, JPG and PNG files are supported.", "UNSUPPORTED_TYPE");
  }

  // multer/busboy decodes file names as latin1; fix non-ASCII names like "Gebührenbescheid.pdf"
  const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
  const fileKey = `${randomUUID()}${detected.ext}`;

  const userId = getUserId(req);
  if (req.isGuest && (await prisma.document.count({ where: { userId } })) >= GUEST_MAX_LETTERS) {
    throw new HttpError(403, `Guests can upload ${GUEST_MAX_LETTERS} letter`, "GUEST_LIMIT");
  }

  await storage.save(fileKey, file.buffer);

  const doc = await prisma.document.create({
    data: {
      userId,
      originalName,
      fileKey,
      mimeType: detected.mime,
      sizeBytes: file.size,
    },
  });

  await enqueueDocument(doc.id);
  res.status(201).json(toDto(doc));
});

// GET /api/documents
documentsRouter.get("/", async (req, res) => {
  const docs = await prisma.document.findMany({
    where: { userId: getUserId(req) },
    orderBy: { createdAt: "desc" },
  });
  res.json(docs.map(toDto));
});

// GET /api/documents/:id  -> document + latest analysis
documentsRouter.get("/:id", async (req, res) => {
  const doc = await prisma.document.findFirst({
    where: { id: routeParam(req, "id"), userId: getUserId(req) },
    include: {
      extractions: { orderBy: { createdAt: "desc" }, take: 1 },
      actionItems: { orderBy: { position: "asc" } },
      deadlines: { orderBy: { dueDate: "asc" } },
    },
  });
  if (!doc) throw new HttpError(404, "Document not found", "DOCUMENT_NOT_FOUND");

  const body: DocumentDetailDto = {
    ...toDto(doc),
    analysis: toAnalysisDto(doc.extractions[0], doc.actionItems, doc.deadlines),
  };
  res.json(body);
});

// PATCH /api/documents/:id  { receivedDate: "YYYY-MM-DD" | null }
// The real delivery date replaces the assumed one, and the deadlines are calculated again.
documentsRouter.patch("/:id", async (req, res) => {
  const body = UpdateDocumentSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Expected { receivedDate: YYYY-MM-DD or null }", "INVALID_BODY");
  const { receivedDate } = body.data;

  const doc = await findOwnedDocument(req);
  if (doc.status === "PROCESSING") {
    throw new HttpError(409, "This letter is being processed. Try again in a moment.", "ALREADY_PROCESSING");
  }
  if (receivedDate !== null) {
    if (!isIsoDate(receivedDate)) throw new HttpError(400, "This date does not exist.", "INVALID_DATE");
    if (receivedDate > todayInGermany()) {
      throw new HttpError(400, "The delivery date cannot be in the future.", "DATE_IN_FUTURE");
    }
    const letterDate = letterOf(await latestExtraction(doc.id))?.letterDate;
    if (letterDate && receivedDate < letterDate) {
      throw new HttpError(400, "The letter cannot have arrived before its own date.", "DATE_BEFORE_LETTER");
    }
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { receivedDate: receivedDate ? new Date(`${receivedDate}T00:00:00Z`) : null },
  });
  if (updated.status === "DONE") await recomputeDeadlines(doc.id);
  res.json(toDto(updated));
});

// DELETE /api/documents/:id  -> removes the file, all analysis data and the queue job
documentsRouter.delete("/:id", async (req, res) => {
  const doc = await findOwnedDocument(req);
  if (doc.status === "PROCESSING") {
    throw new HttpError(409, "This letter is being processed. Try again in a moment.", "ALREADY_PROCESSING");
  }

  await deleteDocuments({ id: doc.id });
  res.status(204).end();
});

// POST /api/documents/:id/retry  -> process a failed (or stale) document again
documentsRouter.post("/:id/retry", async (req, res) => {
  const doc = await findOwnedDocument(req);
  if (doc.status === "PROCESSING") {
    throw new HttpError(409, "This letter is already being processed.", "ALREADY_PROCESSING");
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { status: "UPLOADED", errorMessage: null, errorCode: null },
  });
  await enqueueDocument(doc.id);
  res.status(202).json(toDto(updated));
});

const UpdateActionItemSchema = z.object({ done: z.boolean() });

// PATCH /api/documents/:id/action-items/:itemId  { done: boolean }
documentsRouter.patch("/:id/action-items/:itemId", async (req, res) => {
  const body = UpdateActionItemSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Expected { done: boolean }", "INVALID_BODY");

  const doc = await findOwnedDocument(req);
  const result = await prisma.actionItem.updateMany({
    where: { id: routeParam(req, "itemId"), documentId: doc.id },
    data: { done: body.data.done },
  });
  if (result.count === 0) throw new HttpError(404, "Action item not found", "ACTION_ITEM_NOT_FOUND");

  res.status(204).end();
});

// GET /api/documents/:id/file  -> original file, for the preview
documentsRouter.get("/:id/file", async (req, res) => {
  const doc = await findOwnedDocument(req);
  const stream = await storage.createReadStream(doc.fileKey);
  // Helmet's default CSP (object-src 'none') can stop the browser's built-in PDF viewer
  res.removeHeader("Content-Security-Policy");
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
  stream.pipe(res);
});

/**
 * The first SSE message must include the current step: the worker may have reported it
 * before the browser connected (e.g. while waiting to retry an overloaded AI service).
 * BullMQ keeps the last progress on the job, so we read it from there.
 */
async function currentProgress(doc: Document): Promise<ProgressEvent> {
  if (doc.status === "PROCESSING") {
    const job = await documentQueue.getJob(doc.id);
    if (job && isProgressEvent(job.progress) && job.progress.status === "PROCESSING") {
      return job.progress;
    }
  }
  return {
    status: doc.status,
    message: doc.errorMessage ?? undefined,
    code: isErrorCode(doc.errorCode) ? doc.errorCode : undefined,
  };
}

// GET /api/documents/:id/events  -> Server-Sent Events with processing progress
documentsRouter.get("/:id/events", async (req, res) => {
  const doc = await findOwnedDocument(req);

  const { send } = openSse<ProgressEvent>(res);

  let closed = false;
  let heartbeat: NodeJS.Timeout | undefined;
  let unsubscribe: (() => void) | undefined;

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe?.();
    res.end();
  };

  // Subscribe first, then read the current status, so no event is missed in between.
  unsubscribe = subscribeToDocument(doc.id, (event) => {
    send(event);
    if (isTerminalStatus(event.status)) close();
  });

  const current = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
  send(await currentProgress(current));
  if (isTerminalStatus(current.status)) {
    close();
    return;
  }

  // Comment lines keep proxies from closing an idle connection
  heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", close);
});
