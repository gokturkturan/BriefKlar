import { verifierLlm } from "../llm";
import { LLMError } from "../llm/errors";
import { LLMValidationError } from "../llm/generateStructured";
import type { LLMProvider } from "../llm/LLMProvider";
import { factIssues, replySources, unsupportedFacts } from "../replies/replyFacts";
import { verifyReply } from "../replies/verifyReply";
import type { ReplyCaseFile } from "./replyCaseFile";
import type { Agent } from "./types";

/**
 * Checks a reply draft for made-up facts. Two checks: code compares every number of the draft
 * (amounts, dates, reference numbers) with the analysis and the notes, and the verifier's model
 * (another one than the reply writer's) looks for invented names, events and reasons. Issues go
 * back as a `revise` reply for one correction. When the model fails, the code's check stands.
 */
export function createReplyVerifierAgent(provider: LLMProvider | undefined): Agent<ReplyCaseFile> {
  return {
    name: "verifier",
    async handle(_task, { caseFile }) {
      const { body, extraction, notes, today, documentId } = caseFile;
      if (!body) throw new Error("The verifier needs the reply writer's draft");

      const issues = factIssues(unsupportedFacts(body, replySources({ extraction, notes, today })));
      let model: string | null = null;
      let skipped = "";
      if (provider) {
        try {
          const checked = await verifyReply({ provider, extraction, notes, body, documentId });
          model = checked.model;
          issues.push(...checked.data.issues);
        } catch (err) {
          if (!(err instanceof LLMError) && !(err instanceof LLMValidationError)) throw err;
          console.warn(`Reply check failed for ${documentId}, keeping the code's check:`, err.message);
          skipped = ` (model check skipped: ${err.message.slice(0, 120)})`;
        }
      }

      caseFile.verdict = { issues, model };
      if (issues.length > 0) return { kind: "revise", target: "replyDraft", issues };
      return {
        kind: "result",
        wrote: ["verdict"],
        summary: `The draft states no facts beyond the letter and the notes (${model ?? "code only"})${skipped}`,
      };
    },
  };
}

export const replyVerifierAgent = createReplyVerifierAgent(verifierLlm);
