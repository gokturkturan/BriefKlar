import type { UserQuestion } from "@briefklar/shared";
import type { DeadlineContext, DeadlineRow } from "../deadlines/deadlineRows";

export interface DeadlineQuestion {
  question: UserQuestion;
  /** For the developer overview; the page words the question in the reader's language */
  text: string;
}

/**
 * The question the deadline agent asks the user, if an answer would make a due date exact:
 * - RECEIVED_DATE: a period starts on delivery (Bekanntgabe, Zugang, Zustellung) and the user has
 *   not entered the day the letter arrived, so the date is counted from an assumed delivery day.
 * - FEDERAL_STATE: a due date falls on a public holiday of only some federal states, and the
 *   user's state is not known, so the date may be a day too early.
 * The delivery date comes first: it moves every estimated date, and a run asks only once.
 */
export function deadlineQuestion(rows: DeadlineRow[], context: DeadlineContext): DeadlineQuestion | null {
  const estimated = rows.filter((row) => row.isEstimate);
  if (estimated.length > 0 && !context.receivedDate) {
    return {
      question: "RECEIVED_DATE",
      text: `${estimated.length} due date(s) are counted from an assumed delivery day. When did the letter arrive?`,
    };
  }

  const regional = rows.filter((row) => row.steps.some((step) => step.type === "REGIONAL_HOLIDAY"));
  if (regional.length > 0 && !context.state) {
    return {
      question: "FEDERAL_STATE",
      text: `${regional.length} due date(s) fall on a holiday of some federal states. Which state does the user live in?`,
    };
  }
  return null;
}
