import type { ReactNode } from "react";
import { EXPLANATION_LANGUAGES, type LetterAnalysisDto, type Urgency } from "@briefklar/shared";
import { useI18n, type I18n } from "../i18n/I18nProvider";
import { ActionItems } from "./analysis/ActionItems";
import { DeadlineList } from "./analysis/DeadlineList";
import { textProps } from "./analysis/textProps";
import { useAnalysisTexts } from "./analysis/useAnalysisTexts";
import { ChatPanel } from "./ChatPanel";
import { ExplanationPanel } from "./ExplanationPanel";
import { ReplyDraftsPanel } from "./ReplyDraftsPanel";

const urgencyStyles: Record<Urgency, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

/** "deadlines[0].explicitDate" -> "deadlines" in the reader's language */
function uncertainFieldNames({ t }: I18n, fields: string[]): string {
  const names = fields.map((field) => {
    const base = field.split(/[.[]/)[0] ?? field;
    return (t.analysis.fields as Record<string, string | undefined>)[base] ?? field;
  });
  return [...new Set(names)].join(", ");
}

export function AnalysisPanel({
  documentId,
  analysis,
  receivedDate,
}: {
  documentId: string;
  analysis: LetterAnalysisDto;
  receivedDate: string | null;
}) {
  const i18n = useI18n();
  const { t, language, formatDate, formatMoney } = i18n;
  const { extraction } = analysis;
  const { texts, textLanguage, translating, failed, retry } = useAnalysisTexts(documentId, analysis, language);

  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${urgencyStyles[extraction.urgency]}`}
          >
            {t.analysis.urgency[extraction.urgency]}
          </span>
          <span className="text-xs text-slate-500">{t.analysis.letterTypes[extraction.letterType]}</span>
        </div>
        <h2 className="mt-2 text-lg font-semibold" dir="auto">
          {extraction.subject}
        </h2>
        <p className="text-sm text-slate-500">
          <bdi>{extraction.sender.name}</bdi> · {t.analysis.senderTypes[extraction.sender.type]}
          {extraction.letterDate && <> · {formatDate(extraction.letterDate)}</>}
        </p>
      </header>

      {translating && (
        <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          {t.analysis.translating(EXPLANATION_LANGUAGES[language])}
        </p>
      )}
      {failed && (
        <p className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.analysis.translationFailed}
          <button type="button" onClick={retry} className="font-medium underline">
            {t.common.tryAgain}
          </button>
        </p>
      )}

      {!extraction.isOfficialLetter && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">{t.analysis.notOfficial}</p>
      )}

      <p className="leading-relaxed text-slate-800" {...textProps(textLanguage)}>
        {texts.summary}
      </p>

      {extraction.uncertainFields.length > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.analysis.uncertain(uncertainFieldNames(i18n, extraction.uncertainFields))}
        </p>
      )}

      <Section title={t.analysis.sections.explained}>
        <ExplanationPanel documentId={documentId} />
      </Section>

      <Section title={t.analysis.sections.chat}>
        <ChatPanel documentId={documentId} />
      </Section>

      <Section title={t.analysis.sections.todo}>
        <ActionItems documentId={documentId} analysis={analysis} texts={texts} textLanguage={textLanguage} />
      </Section>

      {extraction.deadlines.length > 0 && (
        <Section title={t.analysis.sections.deadlines}>
          <DeadlineList documentId={documentId} analysis={analysis} receivedDate={receivedDate} />
        </Section>
      )}

      {extraction.amounts.length > 0 && (
        <Section title={t.analysis.sections.amounts}>
          <ul className="space-y-1">
            {extraction.amounts.map((a, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="text-slate-600" {...textProps(textLanguage)}>
                  {texts.amountPurposes[i] ?? a.purpose}
                </span>
                <span className="font-medium tabular-nums" dir="ltr">
                  {formatMoney(a.value, a.currency)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {extraction.requiredDocuments.length > 0 && (
        <Section title={t.analysis.sections.documents}>
          <ul className="list-disc space-y-1 ps-5 text-slate-800">
            {extraction.requiredDocuments.map((doc, i) => (
              <li key={i} {...textProps(textLanguage)}>
                {texts.requiredDocuments[i] ?? doc}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {extraction.references.length > 0 && (
        <Section title={t.analysis.sections.references}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {extraction.references.map((r, i) => (
              <div key={i} className="contents">
                <dt className="text-slate-500" {...textProps(textLanguage)}>
                  {texts.referenceLabels[i] ?? r.label}
                </dt>
                <dd className="font-mono" dir="ltr">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {extraction.objectionPossible && (
        <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700">{t.analysis.objectionRight}</p>
      )}

      {extraction.isOfficialLetter && (
        <Section title={t.analysis.sections.reply}>
          <ReplyDraftsPanel
            documentId={documentId}
            objectionPossible={extraction.objectionPossible}
            hasDocuments={extraction.requiredDocuments.length > 0}
          />
        </Section>
      )}

      <footer className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        {t.analysis.footer(analysis.model, analysis.promptVersion)}
      </footer>
    </div>
  );
}
