import type {
  AgentIssue,
  ChatSourceDto,
  ExplanationLanguage,
  LetterExtraction,
  ReplyBody,
  ReplyType,
} from "@briefklar/shared";
import type { ReplyNoteTopic } from "../replies/replyNotes";

/** The shared state of a run that writes a reply draft (from the chat or the reply panel) */
export interface ReplyCaseFile {
  documentId: string;
  type: ReplyType;
  /** The user's own words: reasons, amounts, wishes; after a question, their answer */
  notes: string;
  /** Language of the translation next to the German text */
  language: ExplanationLanguage;
  /** The analysis of the letter the reply answers */
  extraction: LetterExtraction;
  /** Today in Germany (YYYY-MM-DD): the date of the letter, and a date the draft may name */
  today: string;
  /**
   * true while the reply writer may ask the user for missing details (once per run, and only
   * in the chat; the reply panel has its own notes field)
   */
  mayAsk: boolean;
  /** Written by the reply writer when it asks: what only the user knows */
  missing?: ReplyNoteTopic[];
  /** Written by the reply writer */
  body?: ReplyBody;
  model?: string;
  /** Written by the verifier: facts of the draft that neither the analysis nor the notes back */
  verdict?: { issues: AgentIssue[]; model: string | null };
  /** Numbers the last safeguard replaced with a placeholder before the draft was saved */
  replaced?: string[];
  /** Written by the research agent: official sources about this kind of reply */
  sources?: ChatSourceDto[];
}
