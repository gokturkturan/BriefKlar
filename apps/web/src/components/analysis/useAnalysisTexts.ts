import { useQuery } from "@tanstack/react-query";
import {
  ANALYSIS_LANGUAGE,
  translatableTexts,
  type ExplanationLanguage,
  type LetterAnalysisDto,
} from "@briefklar/shared";
import { api, queryKeys } from "../../api/client";

/**
 * The analysis texts in the reader's language. Letters analyzed before the user chose their
 * language are translated on first view; until then (or if it fails) the English texts show.
 */
export function useAnalysisTexts(documentId: string, analysis: LetterAnalysisDto, language: ExplanationLanguage) {
  const needsTranslation = language !== ANALYSIS_LANGUAGE;
  const translation = useQuery({
    queryKey: queryKeys.translation(documentId, language, analysis.createdAt),
    queryFn: () => api.getAnalysisTranslation(documentId, language),
    enabled: needsTranslation,
    staleTime: Infinity,
  });
  const translated = needsTranslation && translation.data !== undefined;
  return {
    texts: translated ? translation.data : translatableTexts(analysis.extraction),
    textLanguage: translated ? language : ANALYSIS_LANGUAGE,
    translating: needsTranslation && translation.isPending,
    failed: needsTranslation && translation.isError,
    retry: () => void translation.refetch(),
  };
}
