import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { documentQueue } from "../documents/documentQueue";
import { storage } from "../lib/storage";
import { expiredDocumentsWhere } from "./retention";

/**
 * Data protection: everything stored about a user can be exported (GDPR Art. 15 and 20) and
 * deleted (Art. 17). Letters can also be deleted after a period the user chooses (Art. 5 (1) e).
 */

/** Format version of the export, so a later import can tell old files apart */
export const EXPORT_VERSION = 1;

/**
 * All data of a user as one JSON document: the settings, every letter with its original file
 * (base64), analyses, translations, explanations, deadlines, tasks, reply drafts and chat,
 * the reminders, and which AI calls processed each letter.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      documents: {
        orderBy: { createdAt: "asc" },
        include: {
          extractions: { orderBy: { createdAt: "asc" }, include: { translations: true } },
          explanations: true,
          deadlines: { orderBy: { dueDate: "asc" } },
          actionItems: { orderBy: { position: "asc" } },
          replyDrafts: { orderBy: { createdAt: "asc" } },
          chatMessages: { orderBy: { createdAt: "asc" } },
          llmCalls: {
            orderBy: { createdAt: "asc" },
            select: { createdAt: true, purpose: true, provider: true, model: true, success: true },
          },
        },
      },
      reminders: { orderBy: { remindOn: "asc" } },
    },
  });

  const documents = [];
  for (const { userId: _userId, fileKey, ...doc } of user.documents) {
    // A file that is missing on disk must not stop the export of everything else
    const file = await storage.read(fileKey).catch(() => null);
    documents.push({
      ...doc,
      file: file ? { mimeType: doc.mimeType, base64: file.toString("base64") } : null,
    });
  }

  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      settings: {
        preferredLanguage: user.preferredLanguage,
        state: user.state,
        retentionDays: user.retentionDays,
      },
    },
    documents,
    reminders: user.reminders.map(({ userId: _userId, ...reminder }) => reminder),
    notes: [
      "Each letter's file is included as base64.",
      "AI calls list which model processed a letter and when; prompts and answers are not stored apart from the results above.",
    ],
  };
}

/**
 * Deletes letters with everything that belongs to them: the database rows (the schema
 * cascades to analyses, deadlines, chat...), the queue jobs and the files. Logged AI calls stay
 * for cost statistics, without the link to the letter. Returns how many letters were deleted.
 */
export async function deleteDocuments(where: Prisma.DocumentWhereInput): Promise<number> {
  const docs = await prisma.document.findMany({ where, select: { id: true, fileKey: true } });
  if (docs.length === 0) return 0;

  for (const doc of docs) {
    const job = await documentQueue.getJob(doc.id);
    await job?.remove().catch(() => undefined); // an active job cannot be removed; it finds no document
  }
  await prisma.document.deleteMany({ where: { id: { in: docs.map((doc) => doc.id) } } });
  for (const doc of docs) {
    await storage.delete(doc.fileKey).catch((err: unknown) => {
      console.error(`Could not delete the file of document ${doc.id}:`, err);
    });
  }
  return docs.length;
}

/** Deletes the user's letters, files, reminders and settings, and finally the account */
export async function deleteUserData(userId: string): Promise<void> {
  await deleteDocuments({ userId });
  await prisma.user.delete({ where: { id: userId } }); // cascades to reminders and sessions
}

/** Deletes every letter whose retention period has passed; run by a scheduled worker job */
export async function deleteExpiredDocuments(now = new Date()): Promise<number> {
  let deleted = 0;
  for (const { where } of expiredDocumentsWhere(now)) deleted += await deleteDocuments(where);
  return deleted;
}
