import {
  EXPLANATION_LANGUAGES,
  GERMAN_STATE_NAMES,
  GERMAN_STATES,
  isExplanationLanguage,
  isGermanState,
} from "@briefklar/shared";
import { useSettings } from "../hooks/useSettings";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

export function SettingsPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const { settings, update } = useSettings();

  if (settings.isLoading) return <p className="text-slate-500">{t.common.loading}</p>;
  if (settings.error) return <p className="text-red-600">{errorText(settings.error)}</p>;
  if (!settings.data) return null;

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t.settings.title}</h1>

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="font-medium text-slate-900">{t.settings.language}</span>
          <span className="mt-1 block text-sm text-slate-600">{t.settings.languageHint}</span>
          <select
            value={settings.data.preferredLanguage}
            onChange={(e) => {
              const value = e.target.value;
              if (isExplanationLanguage(value)) update.mutate({ preferredLanguage: value });
            }}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code} lang={code}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-medium text-slate-900">{t.settings.state}</span>
          <span className="mt-1 block text-sm text-slate-600">{t.settings.stateHint}</span>
          <select
            value={settings.data.state ?? ""}
            onChange={(e) => update.mutate({ state: isGermanState(e.target.value) ? e.target.value : null })}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">{t.settings.stateNotSet}</option>
            {GERMAN_STATES.map((state) => (
              <option key={state} value={state}>
                {GERMAN_STATE_NAMES[state]}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm text-slate-500" aria-live="polite">
          {update.isPending
            ? t.common.saving
            : update.error
              ? errorText(update.error)
              : update.isSuccess
                ? t.common.saved
                : ""}
        </p>
      </div>
    </div>
  );
}
