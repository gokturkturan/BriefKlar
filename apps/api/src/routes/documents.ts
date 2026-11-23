import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import multer from "multer";
import type { ActionItem, Deadline, Document, Extraction } from "@prisma/client";
import { z } from "zod";
import {
  isTerminalStatus,
  LetterExtractionSchema,
  UPLOAD_LIMITS,
  type AcceptedMimeType,
  type DocumentDetailDto,
  type DocumentDto,
  type LetterAnalysisDto,
  type ProgressEvent,
} from "@briefklar/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/httpError";
import { detectFileType } from "../lib/fileType";
import { storage } from "../storage";
import { documentQueue, enqueueDocument } from "../queue/documentQueue";
import { subscribeToDocument } from "../queue/documentEvents";
import { getUserId } from "../middleware/demoUser";

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
    createdAt: doc.createdAt.toISOString(),
  };
}

function toAnalysisDto(
  extraction: Extraction | undefined,
  actionItems: ActionItem[],
  deadlines: Deadline[],
): LetterAnalysisDto | null {
  if (!extraction) return null;
  // Stored JSON is validated again when read: old rows may come from an older schema version
  const parsed = LetterExtractionSchema.safeParse(extraction.data);
  if (!parsed.success) return null;

  return {
    extraction: parsed.data,
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
      explanation: d.explanation,
    })),
  };
}

/** Express 5 types route params as string | string[] (wildcards); our routes only use plain ones. */
function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") throw new HttpError(400, `Invalid route parameter: ${name}`);
  return value;
}

async function findOwnedDocument(req: Request): Promise<Document> {
  const doc = await prisma.document.findFirst({
    where: { id: routeParam(req, "id"), userId: getUserId(req) },
  });
  if (!doc) throw new HttpError(404, "Document not found", "DOCUMENT_NOT_FOUND");
  return doc;
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

  await storage.save(fileKey, file.buffer);

  const doc = await prisma.document.create({
    data: {
      userId: getUserId(req),
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

// DELETE /api/documents/:id  -> removes the file, all analysis data and the queue job
documentsRouter.delete("/:id", async (req, res) => {
  const doc = await findOwnedDocument(req);
  if (doc.status === "PROCESSING") {
    throw new HttpError(409, "This letter is being processed. Try again in a moment.", "ALREADY_PROCESSING");
  }

  const job = await documentQueue.getJob(doc.id);
  await job?.remove().catch(() => undefined); // a job that just started will finish and find no document

  await prisma.document.delete({ where: { id: doc.id } }); // cascades to extractions, items, deadlines...
  await storage.delete(doc.fileKey);
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
    data: { status: "UPLOADED", errorMessage: null },
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

function isProgressEvent(value: unknown): value is ProgressEvent {
  return typeof value === "object" && value !== null && "status" in value;
}

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
  return { status: doc.status, message: doc.errorMessage ?? undefined };
}

// GET /api/documents/:id/events  -> Server-Sent Events with processing progress
documentsRouter.get("/:id/events", async (req, res) => {
  const doc = await findOwnedDocument(req);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable buffering behind nginx
  });

  const send = (event: ProgressEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

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
