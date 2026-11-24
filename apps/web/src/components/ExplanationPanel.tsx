import { useState } from "react";
import {
  EXPLANATION_LANGUAGES,
  isExplanationLanguage,
  RTL_LANGUAGES,
  type ExplanationLanguage,
} from "@briefklar/shared";
import { useExplanationStream } from "../hooks/useExplanationStream";
import { PlainText } from "./PlainText";

const STORAGE_KEY = "briefklar.explanationLanguage";

function storedLanguage(): ExplanationLanguage {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isExplanationLanguage(value) ? value : "en";
  } catch {
    return "en";
  }
}

export function ExplanationPanel({ documentId }: { documentId: string }) {
  const [language, setLanguage] = useState<ExplanationLanguage>(storedLanguage);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const state = useExplanationStream(documentId, language, requested, attempt);

  const changeLanguage = (value: string) => {
    if (!isExplanationLanguage(value)) return;
    setLanguage(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage can be blocked: the choice is then only kept for this page
    }
  };

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
          aria-label="Language of the explanation"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
            <option key={code} value={code}>
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
            Explain in plain language
          </button>
        )}
        {busy && (
          <span className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {state.text ? "Writing…" : "Reading the letter…"}
          </span>
        )}
      </div>

      {text && (
        <div className="mt-3" dir={RTL_LANGUAGES.includes(language) ? "rtl" : "ltr"} lang={language}>
          <PlainText text={text} />
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-700">
          {state.message}
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-medium underline">
            Try again
          </button>
        </p>
      )}

      {state.status === "done" && (
        <p className="mt-3 text-xs text-slate-500">
          Written by {state.explanation.model}. Check names, amounts and dates in the original letter.
        </p>
      )}
    </div>
  );
}
