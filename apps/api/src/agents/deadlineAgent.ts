import { Prisma } from "@prisma/client";
import { todayInGermany } from "../deadlines/calendarDate";
import { deadlineRows } from "../deadlines/deadlineRows";
import { deadlineContext } from "../deadlines/recomputeDeadlines";
import { prisma } from "../lib/prisma";
import { syncDeadlineReminders } from "../reminders/deadlineReminders";
import type { DocumentCaseFile } from "./documentCaseFile";
import type { Agent } from "./types";

/**
 * Turns the deadline wording of the analysis into due dates with the deadline engine (no AI)
 * and stores the analysis, its tasks, deadlines and deadline reminders in one transaction.
 */
export const deadlineAgent: Agent<DocumentCaseFile> = {
  name: "deadline",
  usesModel: false,
  async handle(_task, { caseFile, report }) {
    const { documentId, extraction, model, promptVersion } = caseFile;
    if (!extraction || !model || !promptVersion) {
      throw new Error("The deadline agent needs the analysis of the extractor");
    }

    await report("saving");
    let deadlineCount = 0;
    caseFile.savedExtraction = await prisma.$transaction(async (tx) => {
      const row = await tx.extraction.create({
        data: {
          documentId,
          data: extraction as unknown as Prisma.InputJsonValue,
          urgency: extraction.urgency,
          model,
          promptVersion,
        },
      });

      // Replace instead of append, so a re-run never creates duplicates
      await tx.actionItem.deleteMany({ where: { documentId } });
      await tx.deadline.deleteMany({ where: { documentId } });
      // Explanations are based on the old analysis and its deadlines
      await tx.explanation.deleteMany({ where: { documentId } });

      await tx.actionItem.createMany({
        data: extraction.requiredActions.map((text, position) => ({ documentId, text, position })),
      });
      const deadlines = deadlineRows(documentId, extraction, await deadlineContext(documentId, tx));
      deadlineCount = deadlines.length;
      await tx.deadline.createMany({ data: deadlines });
      await syncDeadlineReminders(tx, documentId, deadlines, todayInGermany());
      return row;
    });

    return { kind: "result", wrote: ["extraction", "deadlines"], summary: `${deadlineCount} deadline(s) stored` };
  },
};
