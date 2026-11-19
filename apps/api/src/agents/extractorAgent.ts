import { extractLetter, EXTRACT_LETTER_PROMPT_VERSION } from "../documents/extractLetter";
import { storage } from "../lib/storage";
import type { DocumentCaseFile } from "./documentCaseFile";
import type { Agent } from "./types";

/** Reads the letter and writes the structured analysis (extract-letter prompt) to the case file */
export const extractorAgent: Agent<DocumentCaseFile> = {
  name: "extractor",
  async handle(_task, { caseFile, report }) {
    await report("preprocessing");
    const file = await storage.read(caseFile.fileKey);

    await report("extracting");
    const { data, model } = await extractLetter({
      file,
      mimeType: caseFile.mimeType,
      documentId: caseFile.documentId,
    });
    caseFile.extraction = data;
    caseFile.model = model;
    caseFile.promptVersion = EXTRACT_LETTER_PROMPT_VERSION;

    return {
      kind: "result",
      wrote: ["extraction"],
      summary: `${data.letterType}, urgency ${data.urgency}, ${data.deadlines.length} deadline(s) (${model})`,
    };
  },
};
