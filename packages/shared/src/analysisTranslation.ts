import { z } from "zod";
import type { ExplanationLanguage } from "./explanation";
import type { LetterExtraction } from "./letter";

/**
 * The analysis is written in English (ANALYSIS_LANGUAGE) once (stable for tests and evals). The texts a reader
 * sees are then translated into their language and cached per analysis and language.
 * Lists keep the order of the English analysis, so item i belongs to item i.
 */
export const ANALYSIS_LANGUAGE: ExplanationLanguage = "en";

export const AnalysisTranslationSchema = z.object({
  summary: z.string(),
  requiredActions: z.array(z.string()),
  requiredDocuments: z.array(z.string()),
  /** One entry per amount: what it is for */
  amountPurposes: z.array(z.string()),
  /** One entry per reference number: its label, e.g. "Vergi numarası (Steuernummer)" */
  referenceLabels: z.array(z.string()),
});
export type AnalysisTranslation = z.infer<typeof AnalysisTranslationSchema>;

/** The English texts of an analysis that get translated */
export function translatableTexts(extraction: LetterExtraction): AnalysisTranslation {
  return {
    summary: extraction.summary,
    requiredActions: extraction.requiredActions,
    requiredDocuments: extraction.requiredDocuments,
    amountPurposes: extraction.amounts.map((amount) => amount.purpose),
    referenceLabels: extraction.references.map((reference) => reference.label),
  };
}

/**
 * Schema with the exact list lengths of the source. The model sees them as minItems/maxItems,
 * and an answer that drops or merges an item fails validation and is sent back for repair:
 * otherwise a translated action could end up next to the wrong checkbox.
 */
export function translationSchemaFor(source: AnalysisTranslation): z.ZodType<AnalysisTranslation> {
  return AnalysisTranslationSchema.extend({
    summary: z.string().min(1),
    requiredActions: z.array(z.string()).length(source.requiredActions.length),
    requiredDocuments: z.array(z.string()).length(source.requiredDocuments.length),
    amountPurposes: z.array(z.string()).length(source.amountPurposes.length),
    referenceLabels: z.array(z.string()).length(source.referenceLabels.length),
  });
}

export interface AnalysisTranslationDto extends AnalysisTranslation {
  language: ExplanationLanguage;
  model: string;
  createdAt: string;
}
