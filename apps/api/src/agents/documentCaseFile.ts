import type { Extraction } from "@prisma/client";
import type { AgentIssue, ExplanationLanguage, IntakeResult, LetterExtraction, UserQuestion } from "@briefklar/shared";

/** The shared state of a run that analyses an uploaded letter */
export interface DocumentCaseFile {
  documentId: string;
  fileKey: string;
  mimeType: string;
  /** Language the user reads in; the analysis is translated into it when it is not English */
  language: ExplanationLanguage | null;
  /** Set when the user asked for the full analysis of a document the intake agent screened out */
  skipIntake?: boolean;
  /** The uploaded file, read once by the first agent that needs it */
  file?: Buffer;
  /** Written by the intake agent: official letter or not, type, language, scan quality */
  intake?: IntakeResult & { model: string };
  /** Written by the extractor (or by the intake agent for a document that is not an official letter) */
  extraction?: LetterExtraction;
  model?: string;
  promptVersion?: string;
  /** Written by the verifier: what it found wrong with the current analysis (empty = approved) */
  verdict?: { issues: AgentIssue[]; model: string };
  /** Correction rounds the extractor made after a verdict */
  revisions?: number;
  /** Written by the deadline agent, which stores the analysis together with its deadlines */
  savedExtraction?: Extraction;
  /**
   * Set when the run goes on after the user answered the deadline agent's question: the date or
   * the state is already stored (Document, User), the agents before the question are not run again
   */
  answer?: { question: UserQuestion; value: string | null };
}
