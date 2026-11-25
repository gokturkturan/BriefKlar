import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  DEADLINE_KIND_LABELS,
  LETTER_TYPE_LABELS,
  SENDER_TYPE_LABELS,
  type DeadlineDto,
  type DeadlineKind,
  type DocumentDetailDto,
  type LetterAnalysisDto,
  type Urgency,
} from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { ExplanationPanel } from "./ExplanationPanel";
import { ReplyDraftsPanel } from "./ReplyDraftsPanel";

const urgencyStyles: Record<Urgency, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

const urgencyLabels: Record<Urgency, string> = {
  LOW: "Low urgency",
  MEDIUM: "Action needed",
  HIGH: "Urgent",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const formatDate = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function DeadlineItem({ deadline: d }: { deadline: DeadlineDto }) {
  const kind = DEADLINE_KIND_LABELS[d.kind as DeadlineKind] ?? d.kind;
  return (
    <li className="rounded-md bg-red-50 px-3 py-2">
      <p className="flex flex-wrap items-center gap-2 font-medium text-red-900">
        {formatDate(d.dueDate)} · {kind}
        {d.isEstimate && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Estimated
          </span>
        )}
      </p>
      <p className="text-sm text-red-800/80">"{d.sourceText}"</p>
      {d.explanation.length > 0 && (
        <details className="mt-1 text-sm text-slate-700">
          <summary className="cursor-pointer text-red-900/80">How this date was calculated</summary>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {d.explanation.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

function ActionItems({ documentId, analysis }: { documentId: string; analysis: LetterAnalysisDto }) {
  const queryClient = useQueryClient();
  const key = queryKeys.document(documentId);

  // Optimistic update: the checkbox flips immediately, and is rolled back if the request fails
  const toggle = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      api.updateActionItem(documentId, itemId, done),
    onMutate: async ({ itemId, done }) => {
      await queryClient.cancelQueries({ queryKey: key });
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
    return <p className="text-slate-600">Nothing to do. This letter is for your information.</p>;
  }

  return (
    <ul className="space-y-2">
      {analysis.actionItems.map((item) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => toggle.mutate({ itemId: item.id, done: e.target.checked })}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span className={item.done ? "text-slate-400 line-through" : "text-slate-800"}>
              {item.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function AnalysisPanel({
  documentId,
  analysis,
}: {
  documentId: string;
  analysis: LetterAnalysisDto;
}) {
  const { extraction } = analysis;
  // Deadlines the API could not turn into a date are shown as text only
  const datedTexts = new Set(analysis.deadlines.map((d) => d.sourceText));
  const undatedDeadlines = extraction.deadlines.filter((d) => !datedTexts.has(d.rawText));
  const currency = (value: number, code: string) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: code || "EUR" }).format(value);

  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${urgencyStyles[extraction.urgency]}`}
          >
            {urgencyLabels[extraction.urgency]}
          </span>
          <span className="text-xs text-slate-500">{LETTER_TYPE_LABELS[extraction.letterType]}</span>
        </div>
        <h2 className="mt-2 text-lg font-semibold">{extraction.subject}</h2>
        <p className="text-sm text-slate-500">
          {extraction.sender.name} · {SENDER_TYPE_LABELS[extraction.sender.type]}
          {extraction.letterDate && <> · {formatDate(extraction.letterDate)}</>}
        </p>
      </header>

      {!extraction.isOfficialLetter && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This does not look like an official letter. The results may not be useful.
        </p>
      )}

      <p className="leading-relaxed text-slate-800">{extraction.summary}</p>

      {extraction.uncertainFields.length > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please double-check: {extraction.uncertainFields.join(", ")}. Parts of the letter were hard to
          read or unclear.
        </p>
      )}

      <Section title="Explained in plain language">
        <ExplanationPanel documentId={documentId} />
      </Section>

      <Section title="What you need to do">
        <ActionItems documentId={documentId} analysis={analysis} />
      </Section>

      {(analysis.deadlines.length > 0 || undatedDeadlines.length > 0) && (
        <Section title="Deadlines">
          <ul className="space-y-2">
            {analysis.deadlines.map((d) => (
              <DeadlineItem key={d.id} deadline={d} />
            ))}
            {undatedDeadlines.map((d, i) => (
              <li key={i} className="rounded-md bg-amber-50 px-3 py-2">
                <p className="font-medium text-amber-900">{DEADLINE_KIND_LABELS[d.kind]}</p>
                <p className="text-sm text-amber-800/80">
                  "{d.rawText}" · the date could not be calculated, please check the letter
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {extraction.amounts.length > 0 && (
        <Section title="Amounts">
          <ul className="space-y-1">
            {extraction.amounts.map((a, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="text-slate-600">{a.purpose}</span>
                <span className="font-medium tabular-nums">{currency(a.value, a.currency)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {extraction.requiredDocuments.length > 0 && (
        <Section title="Documents to send">
          <ul className="list-disc space-y-1 pl-5 text-slate-800">
            {extraction.requiredDocuments.map((doc, i) => (
              <li key={i}>{doc}</li>
            ))}
          </ul>
        </Section>
      )}

      {extraction.references.length > 0 && (
        <Section title="Reference numbers">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {extraction.references.map((r, i) => (
              <div key={i} className="contents">
                <dt className="text-slate-500">{r.label}</dt>
                <dd className="font-mono">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {extraction.objectionPossible && (
        <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700">
          You have the right to object to this decision (Widerspruch / Einspruch). Check the deadline
          in the letter.
        </p>
      )}

      {extraction.isOfficialLetter && (
        <Section title="Write a reply in German">
          <ReplyDraftsPanel
            documentId={documentId}
            objectionPossible={extraction.objectionPossible}
            hasDocuments={extraction.requiredDocuments.length > 0}
          />
        </Section>
      )}

      <footer className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Analyzed by {analysis.model} ({analysis.promptVersion}). BriefKlar does not provide legal
        advice. Always check important details in the original letter.
      </footer>
    </div>
  );
}
