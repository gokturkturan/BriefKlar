import type { LetterAnalysisDto } from "@briefklar/shared";
import { useI18n } from "../i18n/I18nProvider";
import { textProps } from "./analysis/textProps";
import { useAnalysisTexts } from "./analysis/useAnalysisTexts";

/**
 * A document the intake agent did not take for an official letter: only what it is, without
 * tasks, deadlines or facts, and a button for the full analysis in case it is a letter after all.
 */
export function ScreenedOutPanel({
  documentId,
  analysis,
  onAnalyseInFull,
  analysingInFull,
}: {
  documentId: string;
  analysis: LetterAnalysisDto;
  onAnalyseInFull: () => void;
  analysingInFull: boolean;
}) {
  const { t, language } = useI18n();
  const { texts, textLanguage } = useAnalysisTexts(documentId, analysis, language);
  const sender = analysis.extraction.sender.name;

  return (
    <div className="space-y-4">
      {sender && (
        <p className="text-sm text-slate-500">
          <bdi>{sender}</bdi>
        </p>
      )}

      <p className="leading-relaxed text-slate-800" {...textProps(textLanguage)}>
        {texts.summary}
      </p>

      <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p>{t.analysis.screenedOut}</p>
        <button
          type="button"
          onClick={onAnalyseInFull}
          disabled={analysingInFull}
          className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {analysingInFull ? t.common.starting : t.analysis.analyseAnyway}
        </button>
      </div>

      <footer className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        {t.analysis.footer(analysis.model, analysis.promptVersion)}
      </footer>
    </div>
  );
}
