import { classifyLetter, CLASSIFY_LETTER_PROMPT_VERSION, screenedOutAnalysis } from "../documents/classifyLetter";
import { LLMError } from "../llm/errors";
import { LLMValidationError } from "../llm/generateStructured";
import { caseFileLetter } from "./caseFileLetter";
import type { DocumentCaseFile } from "./documentCaseFile";
import type { Agent } from "./types";

/**
 * The first agent of an upload: decides whether it is an official letter, its type, language and
 * scan quality, with one short request. For a document that is not an official letter it writes
 * a short analysis (what the document is, nothing to do) to the case file, so the plan can store
 * it without the extractor. The decision is not critical: when the model fails, the run goes on
 * as for an official letter.
 */
export const intakeAgent: Agent<DocumentCaseFile> = {
  name: "intake",
  async handle(_task, { caseFile, report }) {
    await report("classifying");
    try {
      const { data, model } = await classifyLetter({
        file: await caseFileLetter(caseFile),
        mimeType: caseFile.mimeType,
        documentId: caseFile.documentId,
      });
      caseFile.intake = { ...data, model };

      const description = `${data.isOfficialLetter ? "official" : "not official"}, ${data.letterType}, ${data.language}, scan ${data.scanQuality} (${model})`;
      // An unreadable scan says nothing reliable about the letter; the plan stops the run
      if (!data.isOfficialLetter && data.scanQuality !== "UNREADABLE") {
        caseFile.extraction = screenedOutAnalysis(data);
        caseFile.model = model;
        caseFile.promptVersion = CLASSIFY_LETTER_PROMPT_VERSION;
        return { kind: "result", wrote: ["intake", "extraction"], summary: description };
      }
      return { kind: "result", wrote: ["intake"], summary: description };
    } catch (err) {
      if (!(err instanceof LLMError) && !(err instanceof LLMValidationError)) throw err;
      console.warn(`Intake failed for ${caseFile.documentId}, analysing it as a letter:`, err.message);
      return { kind: "result", wrote: [], summary: `Intake skipped: ${err.message.slice(0, 200)}` };
    }
  },
};
