import {
  translatableTexts,
  translationSchemaFor,
  type AnalysisTranslation,
  type ExplanationLanguage,
  type LetterExtraction,
} from "@briefklar/shared";
import {
  TRANSLATE_ANALYSIS_PROMPT_VERSION,
  translateAnalysisInput,
  translateAnalysisSystemPrompt,
} from "../prompts/translateAnalysis";
import { generateStructured, type StructuredResult } from "./generateStructured";
import { llm } from "./index";

export async function translateAnalysis(params: {
  documentId: string;
  extraction: LetterExtraction;
  language: ExplanationLanguage;
}): Promise<StructuredResult<AnalysisTranslation>> {
  const source = translatableTexts(params.extraction);
  return generateStructured({
    provider: llm,
    schema: translationSchemaFor(source),
    system: translateAnalysisSystemPrompt(params.language),
    input: [{ type: "text", text: translateAnalysisInput(params.language, source) }],
    purpose: "translate-analysis",
    promptVersion: TRANSLATE_ANALYSIS_PROMPT_VERSION,
    documentId: params.documentId,
    // A short text, no file: a model that is silent this long is overloaded, so fall back sooner
    timeoutMs: 20_000,
  });
}
