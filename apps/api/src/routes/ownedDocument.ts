import type { Request } from "express";
import type { Document } from "@prisma/client";
import { LetterExtractionSchema, type LetterExtraction } from "@briefklar/shared";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { getUserId } from "../middleware/demoUser";

/** Express 5 types route params as string | string[] (wildcards); our routes only use plain ones. */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") throw new HttpError(400, `Invalid route parameter: ${name}`);
  return value;
}

/** The document from the :id route parameter, if it belongs to the current user */
export async function findOwnedDocument(req: Request): Promise<Document> {
  const doc = await prisma.document.findFirst({
    where: { id: routeParam(req, "id"), userId: getUserId(req) },
  });
  if (!doc) throw new HttpError(404, "Document not found", "DOCUMENT_NOT_FOUND");
  return doc;
}

/** Latest validated extraction of a document; features built on the analysis need one */
export async function requireExtraction(documentId: string): Promise<LetterExtraction> {
  const latest = await prisma.extraction.findFirst({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });
  const parsed = LetterExtractionSchema.safeParse(latest?.data);
  if (!parsed.success) {
    throw new HttpError(409, "This letter has not been analyzed yet.", "NOT_ANALYZED");
  }
  return parsed.data;
}
