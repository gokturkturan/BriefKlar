import type { ReplyType } from "@briefklar/shared";

/** Details of a reply only the user knows */
export type ReplyNoteTopic = "reasons" | "monthlyAmount" | "newDate" | "question";

const TOPIC_TEXTS: Record<ReplyNoteTopic, string> = {
  reasons: "why the user disagrees with the decision (they may also send the reasons later)",
  monthlyAmount: "how much the user can pay per month, and why they cannot pay at once",
  newDate: "why the user needs more time and until when",
  question: "what the user wants to ask the sender",
};

/**
 * What the reply writer asks before it writes (REPLY_NOTES), decided by code: a draft without
 * these details would be mostly placeholders. A cover letter for documents needs nothing.
 * An instalment plan needs a monthly amount, so notes without any number count as missing.
 */
export function missingReplyNotes(type: ReplyType, notes: string): ReplyNoteTopic[] {
  const empty = notes.trim().length === 0;
  switch (type) {
    case "OBJECTION":
      return empty ? ["reasons"] : [];
    case "INSTALLMENT_PLAN":
      return /\d/.test(notes) ? [] : ["monthlyAmount"];
    case "EXTENSION_REQUEST":
      return empty ? ["newDate"] : [];
    case "QUESTION":
      return empty ? ["question"] : [];
    case "SEND_DOCUMENTS":
      return [];
  }
}

/** The reply writer's question in English, for the trace; the chat asks it in the user's language */
export function replyNotesQuestion(type: ReplyType, missing: ReplyNoteTopic[]): string {
  return `To write the ${type} draft, ask the user ${missing.map((topic) => TOPIC_TEXTS[topic]).join("; ")}.`;
}
