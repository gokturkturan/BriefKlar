import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  EXPLANATION_LANGUAGES,
  GERMAN_STATE_NAMES,
  GERMAN_STATES,
  isExplanationLanguage,
  isGermanState,
  isRetentionPeriod,
  PASSWORD_MIN_LENGTH,
  RETENTION_PERIODS,
  type AccountDto,
} from "@briefklar/shared";
import { api, ApiError, queryKeys } from "../api/client";
import { switchAccount, useAccount } from "../hooks/useAccount";
import { useSettings } from "../hooks/useSettings";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2";
const buttonClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50";
const sectionClass = "mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6";

/** The account, the settings and the user's data */
export function ProfilePage() {
  const { t } = useI18n();
  const account = useAccount();
  if (!account.data) return null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t.profile.title}</h1>
      <AccountDetails account={account.data} />
      <PasswordForm />
      <Settings />
      <PrivacySettings />
    </div>
  );
}

function AccountDetails({ account }: { account: AccountDto }) {
  const { t, formatDate } = useI18n();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [name, setName] = useState(account.name ?? "");

  const save = useMutation({
    mutationFn: () => api.updateAccount({ name }),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.account, saved),
  });

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold">{t.profile.account}</h2>
        <p className="mt-1 text-sm text-slate-600">{t.profile.memberSince(formatDate(account.createdAt.slice(0, 10)))}</p>
      </div>
      <div>
        <span className="font-medium text-slate-900">{t.profile.email}</span>
        <p className="mt-1 text-slate-700" dir="ltr">
          {account.email}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block">
          <span className="font-medium text-slate-900">{t.profile.name}</span>
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={save.isPending || name === (account.name ?? "")} className={buttonClass}>
            {t.profile.saveName}
          </button>
          <span className="text-sm text-slate-500" aria-live="polite">
            {save.error ? errorText(save.error) : save.isSuccess ? t.common.saved : ""}
          </span>
        </div>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const change = useMutation({
    mutationFn: () => api.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    change.mutate();
  };

  return (
    <form onSubmit={submit} className={sectionClass}>
      <h2 className="text-lg font-semibold">{t.profile.password}</h2>
      <label className="block">
        <span className="font-medium text-slate-900">{t.profile.currentPassword}</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
          dir="ltr"
        />
      </label>
      <label className="block">
        <span className="font-medium text-slate-900">{t.profile.newPassword}</span>
        <span className="mt-1 block text-sm text-slate-600">{t.auth.passwordHint(PASSWORD_MIN_LENGTH)}</span>
        <input
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
          dir="ltr"
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={change.isPending} className={buttonClass}>
          {t.profile.savePassword}
        </button>
        <span className="text-sm" aria-live="polite">
          {change.error ? (
            <span className="text-red-600">
              {change.error instanceof ApiError && change.error.code === "INVALID_CREDENTIALS"
                ? t.profile.wrongPassword
                : errorText(change.error)}
            </span>
          ) : change.isSuccess ? (
            <span className="text-emerald-700">{t.profile.passwordChanged}</span>
          ) : null}
        </span>
      </div>
    </form>
  );
}

/** Language and federal state */
function Settings() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const { settings, update } = useSettings();

  if (settings.isLoading) return <p className="mt-8 text-slate-500">{t.common.loading}</p>;
  if (settings.error) return <p className="mt-8 text-red-600">{errorText(settings.error)}</p>;
  if (!settings.data) return null;

  return (
    <section className={sectionClass}>
      <h2 className="text-lg font-semibold">{t.settings.title}</h2>
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
    </section>
  );
}

/** Retention period, data export and account deletion (GDPR Art. 5, 15, 17 and 20) */
function PrivacySettings() {
  const { t } = useI18n();
  const texts = t.settings.privacy;
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const { settings, update } = useSettings();
  const [confirming, setConfirming] = useState(false);

  const deleteAccount = useMutation({
    mutationFn: api.deleteAccount,
    // The account is gone: back to the sign-in page, with nothing of it left in the cache
    onSuccess: () => switchAccount(queryClient, null),
  });

  return (
    <section className={sectionClass}>
      <div>
        <h2 className="text-lg font-semibold">{texts.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{texts.processing}</p>
      </div>

      <label className="block">
        <span className="font-medium text-slate-900">{texts.retention}</span>
        <span className="mt-1 block text-sm text-slate-600">{texts.retentionHint}</span>
        <select
          value={settings.data?.retentionDays ?? ""}
          onChange={(e) => {
            const days = Number(e.target.value);
            update.mutate({ retentionDays: isRetentionPeriod(days) ? days : null });
          }}
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
        >
          <option value="">{texts.retentionNever}</option>
          {RETENTION_PERIODS.map((days) => (
            <option key={days} value={days}>
              {texts.retentionDays(days)}
            </option>
          ))}
        </select>
      </label>

      <div>
        <a
          href={api.exportUrl}
          download
          className="inline-block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          {texts.export}
        </a>
        <p className="mt-1 text-sm text-slate-600">{texts.exportHint}</p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        {!confirming ? (
          <button
            type="button"
            onClick={() => {
              deleteAccount.reset();
              setConfirming(true);
            }}
            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {texts.delete}
          </button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-800">{texts.deleteConfirm}</p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => deleteAccount.mutate()}
                disabled={deleteAccount.isPending}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {texts.deleteYes}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleteAccount.isPending}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}
        <p className="mt-1 text-sm text-slate-600">{texts.deleteHint}</p>
        {deleteAccount.error && <p className="mt-2 text-sm text-red-600">{errorText(deleteAccount.error)}</p>}
      </div>
    </section>
  );
}
