import { Link, useLocation } from "react-router";
import { useI18n } from "../i18n/I18nProvider";

/** Shown to guests in place of a feature that needs an account */
export function SignInRequired() {
  const { t } = useI18n();
  const location = useLocation();
  // After signing in, the user comes back here
  const state = { from: location.pathname + location.search };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <p className="font-medium text-slate-900">{t.guest.lockedTitle}</p>
      <p className="mt-1 text-sm text-slate-700">{t.guest.lockedText}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/login"
          state={state}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t.auth.login}
        </Link>
        <Link
          to="/register"
          state={state}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          {t.auth.register}
        </Link>
      </div>
    </div>
  );
}
