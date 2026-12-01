import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  EXPLANATION_LANGUAGES,
  translatableTexts,
  type AnalysisTranslation,
  type DeadlineDto,
  type DeadlineKind,
  type DocumentDetailDto,
  type ExplanationLanguage,
  type LetterAnalysisDto,
  type Urgency,
} from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { deadlineStepText } from "../i18n/deadlineSteps";
import { dirOf, useI18n, type I18n } from "../i18n/I18nProvider";
import { ChatPanel } from "./ChatPanel";
import { ExplanationPanel } from "./ExplanationPanel";
import { ReceivedDateForm } from "./ReceivedDateForm";
import { ReplyDraftsPanel } from "./ReplyDraftsPanel";

/** The analysis itself is written in English and translated for other readers */
const ANALYSIS_LANGUAGE: ExplanationLanguage = "en";

const urgencyStyles: Record<Urgency, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

/** Language attributes for texts that may still be in English on a page in another language */
const textProps = (language: ExplanationLanguage) => ({ lang: language, dir: dirOf(language) });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function DeadlineItem({ deadline: d }: { deadline: DeadlineDto }) {
  const i18n = useI18n();
  const { t, formatDate } = i18n;
  const kind = t.analysis.deadlineKinds[d.kind as DeadlineKind] ?? d.kind;
  return (
    <li className="rounded-md bg-red-50 px-3 py-2">
      <p className="flex flex-wrap items-center gap-2 font-medium text-red-900">
        {formatDate(d.dueDate)} · {kind}
        {d.isEstimate && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {t.analysis.estimated}
          </span>
        )}
      </p>
      {/* Quoted from the German letter */}
      <p className="text-sm text-red-800/80" lang="de" dir="ltr">
        „{d.sourceText}“
      </p>
      {d.steps.length > 0 && (
        <details className="mt-1 text-sm text-slate-700">
          <summary className="cursor-pointer text-red-900/80">{t.analysis.howCalculated}</summary>
          <ol className="mt-1 list-decimal space-y-1 ps-5">
            {d.steps.map((step, i) => (
              <li key={i}>{deadlineStepText(i18n, step)}</li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

function ActionItems({
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

/** "deadlines[0].explicitDate" -> "deadlines" in the reader's language */
function uncertainFieldNames({ t }: I18n, fields: string[]): string {
  const names = fields.map((field) => {
    const base = field.split(/[.[]/)[0] ?? field;
    return (t.analysis.fields as Record<string, string | undefined>)[base] ?? field;
  });
  return [...new Set(names)].join(", ");
}

/**
 * The analysis texts in the reader's language. Letters analyzed before the user chose their
 * language are translated on first view; until then (or if it fails) the English texts show.
 */
function useAnalysisTexts(documentId: string, analysis: LetterAnalysisDto, language: ExplanationLanguage) {
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

  // Deadlines the API could not turn into a date are shown as text only
  const datedTexts = new Set(analysis.deadlines.map((d) => d.sourceText));
  const undatedDeadlines = extraction.deadlines.filter((d) => !datedTexts.has(d.rawText));

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

      {(analysis.deadlines.length > 0 || undatedDeadlines.length > 0) && (
        <Section title={t.analysis.sections.deadlines}>
          <ul className="space-y-2">
            {analysis.deadlines.map((d) => (
              <DeadlineItem key={d.id} deadline={d} />
            ))}
            {undatedDeadlines.map((d, i) => (
              <li key={i} className="rounded-md bg-amber-50 px-3 py-2">
                <p className="font-medium text-amber-900">{t.analysis.deadlineKinds[d.kind]}</p>
                <p className="text-sm text-amber-800/80">
                  <bdi lang="de">„{d.rawText}“</bdi> · {t.analysis.undated}
                </p>
              </li>
            ))}
          </ul>
          <ReceivedDateForm
            documentId={documentId}
            receivedDate={receivedDate}
            letterDate={extraction.letterDate}
          />
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
