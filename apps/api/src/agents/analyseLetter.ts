import { ANALYSIS_LANGUAGE } from "@briefklar/shared";
import { deadlineAgent } from "./deadlineAgent";
import type { DocumentCaseFile } from "./documentCaseFile";
import { extractorAgent } from "./extractorAgent";
import type { Orchestrator } from "./orchestrator";
import { translatorAgent } from "./translatorAgent";
import type { Agent } from "./types";

export interface LetterAgents {
  extractor: Agent<DocumentCaseFile>;
  deadline: Agent<DocumentCaseFile>;
  translator: Agent<DocumentCaseFile>;
}

export const LETTER_AGENTS: LetterAgents = {
  extractor: extractorAgent,
  deadline: deadlineAgent,
  translator: translatorAgent,
};

/**
 * The plan for an uploaded letter: the extractor analyses it, the deadline agent computes the
 * deadlines and stores everything, the translator translates the analysis into the user's
 * language. The analysis is written in English, so English readers need no translation.
 */
export async function analyseLetter(
  orchestrator: Orchestrator<DocumentCaseFile>,
  agents: LetterAgents = LETTER_AGENTS,
): Promise<void> {
  const extracted = await orchestrator.dispatch(agents.extractor, "Analyse the letter");
  if (extracted.kind !== "result") throw new Error(`Unexpected ${extracted.kind} from the extractor`);

  const saved = await orchestrator.dispatch(agents.deadline, "Compute the deadlines and store the analysis");
  if (saved.kind !== "result") throw new Error(`Unexpected ${saved.kind} from the deadline agent`);

  const { language } = orchestrator.caseFile;
  if (language && language !== ANALYSIS_LANGUAGE) {
    await orchestrator.dispatch(agents.translator, `Translate the analysis into ${language}`);
  }
}
