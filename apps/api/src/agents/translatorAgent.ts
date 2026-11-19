import { getOrCreateTranslation } from "../translation/analysisTranslations";
import type { DocumentCaseFile } from "./documentCaseFile";
import type { Agent } from "./types";

/**
 * Translates the stored analysis into the user's language. Not critical: a failure is logged and
 * reported as a result without the translation, and the letter page asks for it again.
 */
export const translatorAgent: Agent<DocumentCaseFile> = {
  name: "translator",
  async handle(_task, { caseFile, report }) {
    const { savedExtraction, language, documentId } = caseFile;
    if (!savedExtraction || !language) {
      throw new Error("The translator needs a stored analysis and a language");
    }

    await report("translating");
    try {
      await getOrCreateTranslation(savedExtraction, language);
      return { kind: "result", wrote: ["translation"], summary: `Translated into ${language}` };
    } catch (err) {
      console.warn(`Translation into ${language} failed for ${documentId}:`, err);
      return { kind: "result", wrote: [], summary: `Translation into ${language} failed; the page asks again` };
    }
  },
};
