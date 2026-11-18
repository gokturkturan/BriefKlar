import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import multer from "multer";
import type { Document } from "@prisma/client";
import {
  isTerminalStatus,
  UPLOAD_LIMITS,
  type AcceptedMimeType,
  type DocumentDto,
  type ProgressEvent,
} from "@briefklar/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/httpError";
import { detectFileType } from "../lib/fileType";
import { storage } from "../storage";
import { enqueueDocument } from "../queue/documentQueue";
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

async function findOwnedDocument(req: Request): Promise<Document> {
  const doc = await prisma.document.findFirst({
    where: { id: req.params.id, userId: getUserId(req) },
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

// GET /api/documents/:id
documentsRouter.get("/:id", async (req, res) => {
  res.json(toDto(await findOwnedDocument(req)));
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
  send({ status: current.status, message: current.errorMessage ?? undefined });
  if (isTerminalStatus(current.status)) {
    close();
    return;
  }

  // Comment lines keep proxies from closing an idle connection
  heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", close);
});
