import {
  EXPLANATION_LANGUAGES,
  GERMAN_STATE_NAMES,
  GERMAN_STATES,
  isExplanationLanguage,
  isGermanState,
} from "@briefklar/shared";
import { useSettings } from "../hooks/useSettings";

export function SettingsPage() {
  const { settings, update } = useSettings();

  if (settings.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (settings.error) return <p className="text-red-600">{settings.error.message}</p>;
  if (!settings.data) return null;

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="font-medium text-slate-900">Federal state (Bundesland)</span>
          <span className="mt-1 block text-sm text-slate-600">
            Deadlines that end on a public holiday move to the next working day. Some holidays only
            apply in some states, so your state can change a due date. Without it, only nationwide
            holidays are used.
          </span>
          <select
            value={settings.data.state ?? ""}
            onChange={(e) => update.mutate({ state: isGermanState(e.target.value) ? e.target.value : null })}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Not set (nationwide holidays only)</option>
            {GERMAN_STATES.map((state) => (
              <option key={state} value={state}>
                {GERMAN_STATE_NAMES[state]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-medium text-slate-900">Your language</span>
          <span className="mt-1 block text-sm text-slate-600">
            Used for plain-language explanations and for the translations of reply drafts.
          </span>
          <select
            value={settings.data.preferredLanguage}
            onChange={(e) => {
              const value = e.target.value;
              if (isExplanationLanguage(value)) update.mutate({ preferredLanguage: value });
            }}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm text-slate-500" aria-live="polite">
          {update.isPending ? "Saving…" : update.error ? update.error.message : update.isSuccess ? "Saved." : ""}
        </p>
      </div>
    </div>
  );
}
