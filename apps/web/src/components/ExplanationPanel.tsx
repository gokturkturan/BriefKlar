import { useState } from "react";
import { EXPLANATION_LANGUAGES } from "@briefklar/shared";
import { useExplanationStream } from "../hooks/useExplanationStream";
import { usePanelLanguage } from "../hooks/useSettings";
import { useErrorText } from "../i18n/errors";
import { dirOf, useI18n } from "../i18n/I18nProvider";
import { PlainText } from "./PlainText";

export function ExplanationPanel({ documentId }: { documentId: string }) {
  const { t, language: siteLanguage } = useI18n();
  const errorText = useErrorText();
  // Opens in the site language; another language can be picked for this explanation only
  const [language, changeLanguage] = usePanelLanguage(siteLanguage);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const state = useExplanationStream(documentId, language, requested, attempt);

  const busy = state.status === "streaming";
  const text =
    state.status === "done" ? state.explanation.content : state.status === "idle" ? "" : state.text;

  return (
    <div className="rounded-lg bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => changeLanguage(e.target.value)}
          disabled={busy}
          aria-label={t.explanation.language}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
            <option key={code} value={code} lang={code}>
              {name}
            </option>
          ))}
        </select>
        {!requested && (
          <button
            type="button"
            onClick={() => setRequested(true)}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {t.explanation.explain}
          </button>
        )}
        {busy && (
          <span className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {state.text ? t.explanation.writing : t.explanation.reading}
          </span>
        )}
      </div>

      {text && (
        <div className="mt-3" dir={dirOf(language)} lang={language}>
          <PlainText text={text} />
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-700">
          {state.code ? errorText(null, state.code) : t.errors.connectionLost}
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-medium underline">
            {t.common.tryAgain}
          </button>
        </p>
      )}

      {state.status === "done" && (
        <p className="mt-3 text-xs text-slate-500">{t.explanation.writtenBy(state.explanation.model)}</p>
      )}
    </div>
  );
}
