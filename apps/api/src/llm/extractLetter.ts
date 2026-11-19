import { LetterExtractionSchema, type LetterExtraction } from "@briefklar/shared";
import {
  EXTRACT_LETTER_PROMPT_VERSION,
  EXTRACT_LETTER_SYSTEM_PROMPT,
} from "../prompts/extractLetter";
import { generateStructured, type StructuredResult } from "./generateStructured";
import { llm } from "./index";

export async function extractLetter(params: {
  file: Buffer;
  mimeType: string;
  documentId: string;
}): Promise<StructuredResult<LetterExtraction>> {
  return generateStructured({
    provider: llm,
    schema: LetterExtractionSchema,
    system: EXTRACT_LETTER_SYSTEM_PROMPT,
    input: [
      { type: "file", mimeType: params.mimeType, data: params.file },
      { type: "text", text: "Analyze this letter." },
    ],
    purpose: "extract-letter",
    promptVersion: EXTRACT_LETTER_PROMPT_VERSION,
    documentId: params.documentId,
  });
}
