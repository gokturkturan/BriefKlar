import { extractLetter, EXTRACT_LETTER_PROMPT_VERSION } from "../documents/extractLetter";
import { caseFileLetter } from "./caseFileLetter";
import type { DocumentCaseFile } from "./documentCaseFile";
import type { Agent } from "./types";

/**
 * Reads the letter and writes the structured analysis (extract-letter prompt) to the case file.
 * A task with notes is a correction round: the notes are the verifier's issues, and the extractor
 * reads the letter again with its earlier analysis and the issues.
 */
export const extractorAgent: Agent<DocumentCaseFile> = {
  name: "extractor",
  async handle(task, { caseFile, report }) {
    const previous = caseFile.extraction;
    const revising = task.notes.length > 0 && previous !== undefined;

    if (!revising) await report("preprocessing");
    const file = await caseFileLetter(caseFile);

    await report("extracting");
    const { data, model } = await extractLetter({
      file,
      mimeType: caseFile.mimeType,
      documentId: caseFile.documentId,
      revision: revising ? { previous, issues: task.notes } : undefined,
    });
    caseFile.extraction = data;
    caseFile.model = model;
    caseFile.promptVersion = EXTRACT_LETTER_PROMPT_VERSION;
    if (revising) caseFile.revisions = (caseFile.revisions ?? 0) + 1;

    return {
      kind: "result",
      wrote: ["extraction"],
      summary:
        `${revising ? `Revised after ${task.notes.length} issue(s): ` : ""}` +
        `${data.letterType}, urgency ${data.urgency}, ${data.deadlines.length} deadline(s) (${model})`,
    };
  },
};
