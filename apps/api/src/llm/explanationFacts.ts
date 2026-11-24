import type { Deadline } from "@prisma/client";
import { DEADLINE_KIND_LABELS, type DeadlineKind, type LetterExtraction } from "@briefklar/shared";

export type DeadlineFact = Pick<Deadline, "dueDate" | "kind" | "sourceText" | "isEstimate">;

/**
 * Facts the model must not work out itself: due dates come from the deadline engine,
 * deadlines without a date are passed on as such.
 */
export function explanationFacts(extraction: LetterExtraction, deadlines: DeadlineFact[]): string {
  const dated = new Set(deadlines.map((d) => d.sourceText));
  const lines = deadlines.map((d) => {
    const kind = DEADLINE_KIND_LABELS[d.kind as DeadlineKind] ?? d.kind;
    const date = d.dueDate.toISOString().slice(0, 10);
    return `- ${kind}: due ${date}${d.isEstimate ? " (estimated)" : ""}. Letter says: "${d.sourceText}"`;
  });
  for (const d of extraction.deadlines) {
    if (!dated.has(d.rawText)) {
      lines.push(`- ${DEADLINE_KIND_LABELS[d.kind]}: no date could be calculated. Letter says: "${d.rawText}"`);
    }
  }

  return [
    "Facts checked by software (use these dates, do not calculate your own):",
    lines.length > 0 ? lines.join("\n") : "- The letter contains no deadlines.",
    "",
    "Analysis of the letter:",
    JSON.stringify(
      {
        sender: extraction.sender,
        letterType: extraction.letterType,
        letterDate: extraction.letterDate,
        subject: extraction.subject,
        amounts: extraction.amounts,
        requiredActions: extraction.requiredActions,
        requiredDocuments: extraction.requiredDocuments,
        objectionPossible: extraction.objectionPossible,
      },
      null,
      2,
    ),
  ].join("\n");
}
