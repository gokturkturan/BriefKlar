import { verifyExtraction } from "../documents/verifyExtraction";
import { verifierLlm } from "../llm";
import { LLMError } from "../llm/errors";
import { LLMValidationError } from "../llm/generateStructured";
import type { LLMProvider } from "../llm/LLMProvider";
import { caseFileLetter } from "./caseFileLetter";
import type { DocumentCaseFile } from "./documentCaseFile";
import type { Agent } from "./types";

/**
 * Compares the extractor's analysis with the letter, using another model than the extractor.
 * Errors it can prove go back as a `revise` reply with one issue each; the orchestrator passes
 * them to the extractor. The check is not critical: when the verifier's model fails, the
 * analysis is kept as it is and the run goes on.
 */
export function createVerifierAgent(provider: LLMProvider | undefined): Agent<DocumentCaseFile> {
  return {
    name: "verifier",
    async handle(_task, { caseFile, report }) {
      const { extraction, documentId, mimeType } = caseFile;
      if (!extraction) throw new Error("The verifier needs the analysis of the extractor");
      if (!provider) return { kind: "result", wrote: [], summary: "No verifier configured" };

      await report("verifying");
      try {
        const { data, model } = await verifyExtraction({
          provider,
          file: await caseFileLetter(caseFile),
          mimeType,
          extraction,
          documentId,
        });
        caseFile.verdict = { issues: data.issues, model };
        if (data.issues.length > 0) return { kind: "revise", target: "extraction", issues: data.issues };
        return { kind: "result", wrote: ["verdict"], summary: `The analysis matches the letter (${model})` };
      } catch (err) {
        if (!(err instanceof LLMError) && !(err instanceof LLMValidationError)) throw err;
        console.warn(`Verification failed for ${documentId}, keeping the analysis:`, err.message);
        return { kind: "result", wrote: [], summary: `Verification skipped: ${err.message.slice(0, 200)}` };
      }
    },
  };
}

export const verifierAgent = createVerifierAgent(verifierLlm);
