import type { Extraction, Prisma } from "@prisma/client";
import { LetterExtractionSchema, type LetterExtraction } from "@briefklar/shared";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";

/** The Prisma client, or the client of a running transaction */
export type Db = Prisma.TransactionClient | typeof prisma;

/** The newest analysis of a document, or null if it has none */
export function latestExtraction(documentId: string, db: Db = prisma): Promise<Extraction | null> {
  return db.extraction.findFirst({ where: { documentId }, orderBy: { createdAt: "desc" } });
}

/** The analysis data, validated again when read: old rows may come from an older schema version */
export function letterOf(row: Extraction | null | undefined): LetterExtraction | null {
  const parsed = LetterExtractionSchema.safeParse(row?.data);
  return parsed.success ? parsed.data : null;
}

/** The newest valid analysis; features built on the analysis need one */
export async function requireExtraction(documentId: string): Promise<LetterExtraction> {
  const letter = letterOf(await latestExtraction(documentId));
  if (!letter) throw new HttpError(409, "This letter has not been analyzed yet.", "NOT_ANALYZED");
  return letter;
}
