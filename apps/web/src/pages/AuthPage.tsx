import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { PASSWORD_MIN_LENGTH } from "@briefklar/shared";
import { useSignIn } from "../hooks/useAccount";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

const inputClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2";

/** Sign in (/login) or create an account (/register) */
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { t, language } = useI18n();
  const errorText = useErrorText();
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const register = mode === "register";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    signIn.mutate(
      register
        ? { mode, data: { email, password, name, preferredLanguage: language } }
        : { mode, data: { email, password } },
    );
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{register ? t.auth.registerTitle : t.auth.loginTitle}</h1>
      <p className="mt-2 text-slate-600">{t.auth.intro}</p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-900">{t.auth.email}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-900">{t.auth.password}</span>
          <input
            type="password"
            required
            minLength={register ? PASSWORD_MIN_LENGTH : undefined}
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
          {register && <span className="mt-1 block text-xs text-slate-500">{t.auth.passwordHint(PASSWORD_MIN_LENGTH)}</span>}
        </label>
        {register && (
          <label className="block">
            <span className="text-sm font-medium text-slate-900">{t.auth.name}</span>
            <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
        )}

        {signIn.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {errorText(signIn.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={signIn.isPending}
          className="w-full rounded-md bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {signIn.isPending ? t.auth.submitting : register ? t.auth.register : t.auth.login}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        {register ? t.auth.haveAccount : t.auth.noAccount}{" "}
        <Link to={register ? "/login" : "/register"} className="font-medium text-emerald-700 hover:underline">
          {register ? t.auth.login : t.auth.register}
        </Link>
      </p>
    </div>
  );
}
