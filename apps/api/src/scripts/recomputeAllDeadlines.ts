import "../config/env";
import { recomputeDeadlines } from "../deadlines/recomputeDeadlines";
import { prisma } from "../lib/prisma";

/**
 * Calculates the deadlines of every analyzed letter again from the stored extractions.
 * No AI calls. Run it after the deadline rules or the stored format change:
 *   npm run deadlines:recompute -w @briefklar/api
 */
async function main() {
  const docs = await prisma.document.findMany({ where: { status: "DONE" }, select: { id: true } });
  let changed = 0;
  for (const doc of docs) {
    if (await recomputeDeadlines(doc.id)) changed++;
  }
  console.log(`Recalculated ${docs.length} letters, due dates changed in ${changed}.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
