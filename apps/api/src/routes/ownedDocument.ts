import type { Request } from "express";
import type { Document } from "@prisma/client";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { getUserId } from "../middleware/demoUser";

/** Express 5 types route params as string | string[] (wildcards); our routes only use plain ones. */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") throw new HttpError(400, `Invalid route parameter: ${name}`, "INVALID_PARAM");
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
