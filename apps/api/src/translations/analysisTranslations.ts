import type { AnalysisTranslation as AnalysisTranslationRow, Extraction, Prisma } from "@prisma/client";
import {
  AnalysisTranslationSchema,
  LetterExtractionSchema,
  type AnalysisTranslationDto,
  type ExplanationLanguage,
} from "@briefklar/shared";
import { prisma } from "../lib/prisma";
import { translateAnalysis } from "../llm/translateAnalysis";
import { TRANSLATE_ANALYSIS_PROMPT_VERSION } from "../prompts/translateAnalysis";

/** The language the analysis itself is written in; it needs no translation */
export const ANALYSIS_LANGUAGE: ExplanationLanguage = "en";

function toDto(row: AnalysisTranslationRow): AnalysisTranslationDto | null {
  const parsed = AnalysisTranslationSchema.safeParse(row.data);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    language: row.language as ExplanationLanguage,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The analysis texts in the given language: from the cache, or translated now and stored.
 * Letters analyzed before the user picked their language are translated on first view.
 */
export async function getOrCreateTranslation(
  extraction: Extraction,
  language: ExplanationLanguage,
): Promise<AnalysisTranslationDto> {
  const cached = await prisma.analysisTranslation.findUnique({
    where: { extractionId_language: { extractionId: extraction.id, language } },
  });
  const cachedDto = cached && toDto(cached);
  if (cachedDto) return cachedDto;

  const letter = LetterExtractionSchema.parse(extraction.data);
  const { data, model } = await translateAnalysis({ documentId: extraction.documentId, extraction: letter, language });

  const fields = {
    data: data as unknown as Prisma.InputJsonValue,
    model,
    promptVersion: TRANSLATE_ANALYSIS_PROMPT_VERSION,
  };
  // Two tabs may translate at the same time; the later one simply overwrites
  const saved = await prisma.analysisTranslation.upsert({
    where: { extractionId_language: { extractionId: extraction.id, language } },
    create: { extractionId: extraction.id, language, ...fields },
    update: fields,
  });
  return toDto(saved)!;
}
