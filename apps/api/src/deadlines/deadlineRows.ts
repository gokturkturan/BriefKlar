import type { DeadlineStep, GermanState, LetterExtraction } from "@briefklar/shared";
import { resolveExplicitDate } from "../lib/germanDates";
import type { IsoDate } from "./calendarDate";
import { computeRelativeDeadline } from "./computeDeadline";

export interface DeadlineRow {
  documentId: string;
  kind: string;
  sourceText: string;
  dueDate: Date;
  isEstimate: boolean;
  steps: DeadlineStep[];
}

export interface DeadlineContext {
  /** Day the user received the letter, if they entered it */
  receivedDate?: IsoDate | null;
  /** The user's federal state, for regional holidays */
  state?: GermanState | null;
}

/**
 * Due dates for the extracted deadlines, all decided by code:
 * - a date written in the wording wins. The model's explicitDate is cross-checked against
 *   the text, because models do misread dates.
 * - otherwise relative wording ("innerhalb eines Monats nach Bekanntgabe") is computed
 *   from the delivery or letter date with the rules of German law.
 * Deadlines that neither way gives a date for are only shown as text.
 */
export function deadlineRows(
  documentId: string,
  extraction: LetterExtraction,
  context: DeadlineContext = {},
): DeadlineRow[] {
  return extraction.deadlines.flatMap((deadline): DeadlineRow[] => {
    const base = { documentId, kind: deadline.kind, sourceText: deadline.rawText };

    const date = resolveExplicitDate(deadline.rawText, deadline.explicitDate);
    if (deadline.explicitDate && date !== deadline.explicitDate) {
      console.warn(
        `Deadline date corrected for ${documentId}: model said ${deadline.explicitDate}, ` +
          `text "${deadline.rawText}" gives ${date ?? "no date"}`,
      );
    }
    if (date) {
      return [{ ...base, dueDate: new Date(`${date}T00:00:00Z`), isEstimate: false, steps: [] }];
    }

    const computed = computeRelativeDeadline({
      rawText: deadline.rawText,
      letterDate: extraction.letterDate,
      senderType: extraction.sender.type,
      receivedDate: context.receivedDate,
      state: context.state ?? undefined,
    });
    if (!computed.ok) {
      console.info(`No due date for "${deadline.rawText}" (${documentId}): ${computed.reason}`);
      return [];
    }
    return [
      {
        ...base,
        dueDate: new Date(`${computed.dueDate}T00:00:00Z`),
        isEstimate: computed.isEstimate,
        steps: computed.steps,
      },
    ];
  });
}
