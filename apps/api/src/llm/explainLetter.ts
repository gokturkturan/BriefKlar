import type { ExplanationLanguage, LetterExtraction } from "@briefklar/shared";
import {
  EXPLAIN_LETTER_PROMPT_VERSION,
  explainLetterInstruction,
  explainLetterSystemPrompt,
} from "../prompts/explainLetter";
import { explanationFacts, type DeadlineFact } from "./explanationFacts";
import { llm } from "./index";
import { streamText } from "./streamText";

export async function explainLetter(params: {
  documentId: string;
  file: Buffer;
  mimeType: string;
  extraction: LetterExtraction;
  deadlines: DeadlineFact[];
  language: ExplanationLanguage;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}) {
  return streamText({
    provider: llm,
    system: explainLetterSystemPrompt(params.language),
    input: [
      { type: "file", mimeType: params.mimeType, data: params.file },
      { type: "text", text: explanationFacts(params.extraction, params.deadlines) },
      { type: "text", text: explainLetterInstruction(params.language) },
    ],
    purpose: "explain-letter",
    promptVersion: EXPLAIN_LETTER_PROMPT_VERSION,
    documentId: params.documentId,
    signal: params.signal,
    onDelta: params.onDelta,
  });
}
