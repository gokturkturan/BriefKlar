import type { Extraction } from "@prisma/client";
import type { AgentIssue, ExplanationLanguage, LetterExtraction } from "@briefklar/shared";

/** The shared state of a run that analyses an uploaded letter */
export interface DocumentCaseFile {
  documentId: string;
  fileKey: string;
  mimeType: string;
  /** Language the user reads in; the analysis is translated into it when it is not English */
  language: ExplanationLanguage | null;
  /** The uploaded file, read once by the first agent that needs it */
  file?: Buffer;
  /** Written by the extractor */
  extraction?: LetterExtraction;
  model?: string;
  promptVersion?: string;
  /** Written by the verifier: what it found wrong with the current analysis (empty = approved) */
  verdict?: { issues: AgentIssue[]; model: string };
  /** Correction rounds the extractor made after a verdict */
  revisions?: number;
  /** Written by the deadline agent, which stores the analysis together with its deadlines */
  savedExtraction?: Extraction;
}
