import { llm } from "../llm";
import type { LLMProvider } from "../llm/LLMProvider";
import { draftReply } from "../replies/draftReply";
import { missingReplyNotes, replyNotesQuestion } from "../replies/replyNotes";
import type { ReplyCaseFile } from "./replyCaseFile";
import type { Agent } from "./types";

/**
 * Writes the body of a German reply (the letter around it is built by code). Before it writes,
 * it may ask the user once for details only they know (REPLY_NOTES): the reasons of an
 * objection, the monthly instalment. That decision is code, so a question costs no model
 * request. With the verifier's issues as task notes it writes the draft again without them.
 */
export function createReplyWriterAgent(provider: LLMProvider = llm): Agent<ReplyCaseFile> {
  return {
    name: "replyWriter",
    async handle(task, { caseFile }) {
      const { type, notes } = caseFile;
      if (caseFile.mayAsk) {
        const missing = missingReplyNotes(type, notes);
        if (missing.length > 0) {
          caseFile.missing = missing;
          return { kind: "question", askUser: true, question: "REPLY_NOTES", text: replyNotesQuestion(type, missing) };
        }
      }

      const corrections = task.notes;
      const { data, model } = await draftReply({
        provider,
        documentId: caseFile.documentId,
        type,
        extraction: caseFile.extraction,
        notes,
        language: caseFile.language,
        corrections,
        previous: corrections.length > 0 ? caseFile.body : undefined,
      });
      caseFile.body = data;
      caseFile.model = model;
      return {
        kind: "result",
        wrote: ["replyDraft"],
        summary:
          `${corrections.length > 0 ? "Corrected" : "Wrote"} the ${type} draft: ` +
          `${data.paragraphs.length} paragraph(s) (${model})`,
      };
    },
  };
}

export const replyWriterAgent = createReplyWriterAgent();
