import type { User } from "@prisma/client";
import { recomputeDeadlines } from "../deadlines/recomputeDeadlines";
import { prisma } from "../lib/prisma";

/**
 * Hands every letter, reminder and logged AI call of one user to another and deletes the first
 * (with its sessions). Used when a guest signs in to an existing account, and for the demo user
 * from before accounts. Returns how many rows moved.
 */
export async function moveUserData(from: User, to: User) {
  const analyzed = await prisma.document.findMany({
    where: { userId: from.id, status: "DONE" },
    select: { id: true },
  });

  const move = { where: { userId: from.id }, data: { userId: to.id } };
  const [letters, reminders, llmCalls] = await prisma.$transaction([
    prisma.document.updateMany(move),
    prisma.reminder.updateMany(move),
    prisma.llmCall.updateMany(move),
    prisma.user.delete({ where: { id: from.id } }),
  ]);

  // Regional holidays of another federal state can move due dates
  if (from.state !== to.state) {
    for (const doc of analyzed) await recomputeDeadlines(doc.id);
  }

  return { letters: letters.count, reminders: reminders.count, llmCalls: llmCalls.count };
}
