import { Prisma } from "@prisma/client";
import { todayInGermany } from "../deadlines/calendarDate";
import { deadlineRows } from "../deadlines/deadlineRows";
import { deadlineContext, recomputeDeadlines } from "../deadlines/recomputeDeadlines";
import { prisma } from "../lib/prisma";
import { syncDeadlineReminders } from "../reminders/deadlineReminders";
import type { DocumentCaseFile } from "./documentCaseFile";
import type { Agent, AgentReply } from "./types";
import { deadlineQuestion } from "./userQuestion";

/**
 * Turns the deadline wording of the analysis into due dates with the deadline engine (no AI)
 * and stores the analysis, its tasks, deadlines and deadline reminders in one transaction.
 *
 * When a due date had to be estimated because the delivery day (or the federal state) is not
 * known, the agent still stores everything, so the page shows the analysis at once, and answers
 * with a question for the user. After the answer (caseFile.answer) the run comes back to it:
 * the stored analysis is kept and only the deadlines are calculated again.
 */
export const deadlineAgent: Agent<DocumentCaseFile> = {
  name: "deadline",
  usesModel: false,
  async handle(_task, { caseFile, report }) {
    const { documentId, extraction, model, promptVersion, answer } = caseFile;
    await report("saving");

    if (answer) {
      // The user entered the date or the state before the run came back here (Document, User)
      const changed = await recomputeDeadlines(documentId);
      const deadlines = await prisma.deadline.findMany({ where: { documentId }, select: { isEstimate: true } });
      const estimated = deadlines.filter((d) => d.isEstimate).length;
      return {
        kind: "result",
        wrote: changed ? ["deadlines"] : [],
        summary:
          `Recomputed after the ${answer.question} answer (${answer.value ?? "unknown"}): ` +
          `${deadlines.length} deadline(s), ${estimated} estimated${changed ? "" : ", unchanged"}`,
      };
    }

    if (!extraction || !model || !promptVersion) {
      throw new Error("The deadline agent needs the analysis of the extractor");
    }

    let reply: AgentReply | undefined;
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
      const context = await deadlineContext(documentId, tx);
      const deadlines = deadlineRows(documentId, extraction, context);
      await tx.deadline.createMany({ data: deadlines });
      await syncDeadlineReminders(tx, documentId, deadlines, todayInGermany());

      const estimated = deadlines.filter((d) => d.isEstimate).length;
      const question = deadlineQuestion(deadlines, context);
      reply = question
        ? { kind: "question", askUser: true, question: question.question, text: question.text }
        : {
            kind: "result",
            wrote: ["extraction", "deadlines"],
            summary: `${deadlines.length} deadline(s) stored, ${estimated} estimated`,
          };
      return row;
    });
    if (!reply) throw new Error("The deadline agent stored no reply");
    return reply;
  },
};
