import { ANALYSIS_LANGUAGE, type AgentIssue } from "@briefklar/shared";
import { markUncertain } from "../documents/verifyExtraction";
import { LLMError } from "../llm/errors";
import { LLMValidationError } from "../llm/generateStructured";
import { deadlineAgent } from "./deadlineAgent";
import type { DocumentCaseFile } from "./documentCaseFile";
import { extractorAgent } from "./extractorAgent";
import { intakeAgent } from "./intakeAgent";
import { AgentLimitError, type Orchestrator } from "./orchestrator";
import { translatorAgent } from "./translatorAgent";
import type { Agent, AgentReply } from "./types";
import { verifierAgent } from "./verifierAgent";

export interface LetterAgents {
  intake: Agent<DocumentCaseFile>;
  extractor: Agent<DocumentCaseFile>;
  verifier: Agent<DocumentCaseFile>;
  deadline: Agent<DocumentCaseFile>;
  translator: Agent<DocumentCaseFile>;
}

export const LETTER_AGENTS: LetterAgents = {
  intake: intakeAgent,
  extractor: extractorAgent,
  verifier: verifierAgent,
  deadline: deadlineAgent,
  translator: translatorAgent,
};

/** The intake agent could not read the upload; a clearer photo is needed, trying again would not help */
export class UnreadableScanError extends Error {
  constructor(documentId: string) {
    super(`The upload of ${documentId} cannot be read`);
    this.name = "UnreadableScanError";
  }
}

/** Correction rounds between the verifier and the extractor */
export const MAX_REVISIONS = 1;

/** Runs an agent whose work is not needed for a usable result; at the run's limit it is skipped */
export async function optional<C>(
  orchestrator: Orchestrator<C>,
  agent: Agent<C>,
  instruction: string,
  options: { parentId?: string } = {},
): Promise<AgentReply | null> {
  try {
    return await orchestrator.dispatch(agent, instruction, options);
  } catch (err) {
    if (err instanceof AgentLimitError) {
      console.warn(`Run ${orchestrator.runId}: skipping ${agent.name} (${err.message})`);
      return null;
    }
    throw err;
  }
}

/**
 * The extractor analyses the letter and the verifier checks the analysis against it. When the
 * verifier finds errors, the extractor gets them as notes and corrects its analysis once; the
 * verifier checks the correction. Fields it still disputes are marked as uncertain, so the page
 * asks the user to check them in the letter. The correction round is left out when the run
 * could not afford it without losing `reserve` model requests (the translation).
 */
export async function extractAndVerify(
  orchestrator: Orchestrator<DocumentCaseFile>,
  agents: Pick<LetterAgents, "extractor" | "verifier">,
  reserve = 0,
): Promise<void> {
  const { caseFile } = orchestrator;
  const extracted = await orchestrator.dispatch(agents.extractor, "Analyse the letter");
  if (extracted.kind !== "result") throw new Error(`Unexpected ${extracted.kind} from the extractor`);

  let verdict = await optional(orchestrator, agents.verifier, "Check the analysis against the letter");
  let disputed: AgentIssue[] = verdict?.kind === "revise" ? verdict.issues : [];

  for (let round = 0; round < MAX_REVISIONS && disputed.length > 0; round++) {
    // A correction and its check: at least two requests besides the reserve
    if ((await orchestrator.llmCallsLeft()) < 2 + reserve) break;
    try {
      await orchestrator.dispatch(agents.extractor, "Correct the analysis", {
        notes: disputed,
        parentId: orchestrator.lastReplyId ?? undefined,
      });
    } catch (err) {
      // The first analysis is still usable; the disputed fields are marked below
      if (!(err instanceof LLMError) && !(err instanceof LLMValidationError)) throw err;
      console.warn(`Run ${orchestrator.runId}: correction failed, keeping the first analysis:`, err.message);
      break;
    }
    verdict = await optional(orchestrator, agents.verifier, "Check the corrected analysis against the letter");
    // Without a second check the correction is trusted; the extractor saw the issues
    disputed = verdict?.kind === "revise" ? verdict.issues : [];
  }

  if (disputed.length > 0 && caseFile.extraction) {
    caseFile.extraction = markUncertain(caseFile.extraction, disputed);
  }
}

/**
 * The plan for an uploaded letter. The intake agent looks at the upload first: an unreadable
 * scan stops the run (the user is asked for a clearer photo), and a document that is not an
 * official letter skips the extractor and the verifier, keeping only the intake's short
 * description. A letter is analysed by the extractor and checked by the verifier (with at most
 * one correction round). The deadline agent computes the deadlines and stores everything, the
 * translator translates the analysis into the user's language. The analysis is written in
 * English, so English readers need no translation.
 *
 * The deadline agent may answer with a question for the user (the delivery day or the federal
 * state): the analysis is stored all the same and the plan goes on; the orchestrator keeps the
 * question and the run waits for the answer at the end. With the answer (caseFile.answer) the
 * plan starts again at the deadline agent: the intake, the extractor and the verifier are not
 * run again, and the translation is only made if it was not made before.
 */
export async function analyseLetter(
  orchestrator: Orchestrator<DocumentCaseFile>,
  agents: LetterAgents = LETTER_AGENTS,
): Promise<void> {
  const { caseFile } = orchestrator;
  const { language } = caseFile;
  const needsTranslation = Boolean(language && language !== ANALYSIS_LANGUAGE);

  if (!caseFile.answer) {
    // The user asked for the full analysis of a screened-out document
    if (!caseFile.skipIntake) {
      await orchestrator.dispatch(agents.intake, "Classify the upload");
      if (caseFile.intake?.scanQuality === "UNREADABLE") throw new UnreadableScanError(caseFile.documentId);
    }

    // The intake agent wrote the analysis of a document that is not an official letter
    const screenedOut = caseFile.intake?.isOfficialLetter === false && caseFile.extraction !== undefined;
    if (!screenedOut) await extractAndVerify(orchestrator, agents, needsTranslation ? 1 : 0);
  }

  const saved = await orchestrator.dispatch(
    agents.deadline,
    caseFile.answer ? "Compute the deadlines again with the user's answer" : "Compute the deadlines and store the analysis",
    { parentId: caseFile.answer ? orchestrator.lastReplyId ?? undefined : undefined },
  );
  if (saved.kind !== "result" && saved.kind !== "question") {
    throw new Error(`Unexpected ${saved.kind} from the deadline agent`);
  }

  if (needsTranslation && !orchestrator.hasRun("translator")) {
    await optional(orchestrator, agents.translator, `Translate the analysis into ${language}`);
  }
}
