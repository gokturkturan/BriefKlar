import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  GERMAN_STATE_NAMES,
  GERMAN_STATES,
  type AnswerQuestionInput,
  type GermanState,
  type PendingQuestionDto,
} from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

/** Local calendar day as YYYY-MM-DD, the latest date a letter can have arrived */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * The one question the agents asked about this letter, in place of the delivery date form: the
 * day the letter arrived, or the user's federal state. The answer lets the run go on, and the
 * deadlines come back exact; "I don't know" keeps the estimated dates and closes the card.
 */
export function QuestionCard({
  documentId,
  question,
  letterDate,
}: {
  documentId: string;
  question: PendingQuestionDto;
  letterDate: string | null;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [state, setState] = useState<GermanState | "">("");

  const answer = useMutation({
    mutationFn: (input: AnswerQuestionInput) => api.answerQuestion(documentId, input),
    // The document comes back with the new due dates and without the question; a state also
    // changes the settings and the dates of the other letters
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      if (question.question === "FEDERAL_STATE") void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  const isReceivedDate = question.question === "RECEIVED_DATE";
  const id = `question-${documentId}`;

  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      className="mt-3 space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm"
    >
      <p id={`${id}-title`} className="font-medium text-amber-900">
        {isReceivedDate ? t.question.receivedTitle : t.question.stateTitle}
      </p>
      <p className="text-amber-900/80">
        {isReceivedDate ? t.question.receivedText(Math.max(1, question.estimatedDeadlines)) : t.question.stateText}
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (isReceivedDate) {
            if (date) answer.mutate({ question: "RECEIVED_DATE", receivedDate: date });
          } else if (state) {
            answer.mutate({ question: "FEDERAL_STATE", state });
          }
        }}
      >
        {isReceivedDate ? (
          <input
            id={id}
            aria-labelledby={`${id}-title`}
            type="date"
            value={date}
            min={letterDate ?? undefined}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1"
          />
        ) : (
          <select
            id={id}
            aria-labelledby={`${id}-title`}
            value={state}
            onChange={(e) => setState(e.target.value as GermanState | "")}
            className="rounded-md border border-slate-300 bg-white px-2 py-1"
          >
            <option value="">{t.question.chooseState}</option>
            {GERMAN_STATES.map((code) => (
              <option key={code} value={code}>
                {GERMAN_STATE_NAMES[code]}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={answer.isPending || (isReceivedDate ? !date : !state)}
          className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {answer.isPending ? t.common.saving : t.question.calculate}
        </button>
        <button
          type="button"
          disabled={answer.isPending}
          onClick={() =>
            answer.mutate(
              isReceivedDate ? { question: "RECEIVED_DATE", receivedDate: null } : { question: "FEDERAL_STATE", state: null },
            )
          }
          className="text-slate-600 hover:underline disabled:opacity-40"
        >
          {isReceivedDate ? t.question.dontKnow : t.question.skip}
        </button>
      </form>
      {isReceivedDate && <p className="text-slate-500">{t.receivedDate.hint}</p>}
      {answer.error && <p className="text-red-600">{errorText(answer.error)}</p>}
    </div>
  );
}
