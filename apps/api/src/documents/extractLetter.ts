import { LetterExtractionSchema, type LetterExtraction } from "@briefklar/shared";
import {
  EXTRACT_LETTER_PROMPT_VERSION,
  EXTRACT_LETTER_SYSTEM_PROMPT,
} from "./extractLetterPrompt";
import { generateStructured, type StructuredResult } from "../llm/generateStructured";
import { llm } from "../llm/index";
import type { LLMProvider } from "../llm/LLMProvider";

export async function extractLetter(params: {
  file: Buffer;
  mimeType: string;
  documentId?: string;
  /** The evaluation runs one model at a time, without the fallback */
  provider?: LLMProvider;
  purpose?: string;
}): Promise<StructuredResult<LetterExtraction>> {
  return generateStructured({
    provider: params.provider ?? llm,
    schema: LetterExtractionSchema,
    system: EXTRACT_LETTER_SYSTEM_PROMPT,
    input: [
      { type: "file", mimeType: params.mimeType, data: params.file },
      { type: "text", text: "Analyze this letter." },
    ],
    purpose: params.purpose ?? "extract-letter",
    promptVersion: EXTRACT_LETTER_PROMPT_VERSION,
    documentId: params.documentId,
  });
}
