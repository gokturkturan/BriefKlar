import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ANALYSIS_LANGUAGE,
  type AnalysisTranslation,
  type DocumentDetailDto,
  type ExplanationLanguage,
  type LetterAnalysisDto,
} from "@briefklar/shared";
import { api, queryKeys } from "../../api/client";
import { useI18n } from "../../i18n/I18nProvider";
import { textProps } from "./textProps";

export function ActionItems({
  documentId,
  analysis,
  texts,
  textLanguage,
}: {
  documentId: string;
  analysis: LetterAnalysisDto;
  texts: AnalysisTranslation;
  textLanguage: ExplanationLanguage;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const key = queryKeys.document(documentId);

  // Optimistic update: the checkbox flips immediately, and is rolled back if the request fails
  const toggle = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      api.updateActionItem(documentId, itemId, done),
    onMutate: async ({ itemId, done }) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<DocumentDetailDto>(key);
      queryClient.setQueryData<DocumentDetailDto>(key, (old) =>
        old?.analysis
          ? {
              ...old,
              analysis: {
                ...old.analysis,
                actionItems: old.analysis.actionItems.map((item) =>
                  item.id === itemId ? { ...item, done } : item,
                ),
              },
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });

  if (analysis.actionItems.length === 0) {
    return <p className="text-slate-600">{t.analysis.nothingToDo}</p>;
  }

  return (
    <ul className="space-y-2">
      {/* Action items are stored in the order of the analysis, so item i has translation i */}
      {analysis.actionItems.map((item, i) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => toggle.mutate({ itemId: item.id, done: e.target.checked })}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span
              className={item.done ? "text-slate-400 line-through" : "text-slate-800"}
              {...textProps(texts.requiredActions[i] ? textLanguage : ANALYSIS_LANGUAGE)}
            >
              {texts.requiredActions[i] ?? item.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
