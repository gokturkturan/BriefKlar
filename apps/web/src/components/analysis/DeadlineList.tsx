import type { DeadlineDto, DeadlineKind, LetterAnalysisDto, PendingQuestionDto } from "@briefklar/shared";
import { deadlineStepText } from "../../i18n/deadlineSteps";
import { useI18n } from "../../i18n/I18nProvider";
import { QuestionCard } from "../QuestionCard";
import { ReceivedDateForm } from "../ReceivedDateForm";

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

/**
 * Deadlines with a due date, those the API could not date, and the form for the delivery date.
 * While the agents wait for an answer (the delivery day or the federal state), their question
 * card takes the place of the form.
 */
export function DeadlineList({
  documentId,
  analysis,
  receivedDate,
  question,
}: {
  documentId: string;
  analysis: LetterAnalysisDto;
  receivedDate: string | null;
  question: PendingQuestionDto | null;
}) {
  const { t } = useI18n();
  const { extraction } = analysis;
  // Deadlines the API could not turn into a date are shown as text only
  const datedTexts = new Set(analysis.deadlines.map((d) => d.sourceText));
  const undatedDeadlines = extraction.deadlines.filter((d) => !datedTexts.has(d.rawText));

  return (
    <>
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
      {question ? (
        <QuestionCard documentId={documentId} question={question} letterDate={extraction.letterDate} />
      ) : (
        <ReceivedDateForm
          documentId={documentId}
          receivedDate={receivedDate}
          letterDate={extraction.letterDate}
        />
      )}
    </>
  );
}
