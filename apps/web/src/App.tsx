import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { EXPLANATION_LANGUAGES } from "@briefklar/shared";
import { SignInRequired } from "./components/SignInRequired";
import { useAccount, useIsMember, useSignOut } from "./hooks/useAccount";
import { useErrorText } from "./i18n/errors";
import { useI18n } from "./i18n/I18nProvider";
import { AuthPage } from "./pages/AuthPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RemindersPage, useDueReminderCount } from "./pages/RemindersPage";
import { UploadPage } from "./pages/UploadPage";
import { UsagePage } from "./pages/UsagePage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export function App() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const account = useAccount();
  const member = useIsMember();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* The brand name reads left to right in every language */}
          <NavLink to="/" dir="ltr" className="text-lg font-semibold tracking-tight">
            Brief<span className="text-emerald-600">Klar</span>
          </NavLink>
          <div className="flex flex-wrap items-center gap-3">
            <Navigation member={member} />
            <LanguageSelect />
            {member ? (
              <SignOutButton />
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                {t.auth.login}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {account.isPending ? (
          <p className="text-slate-500">{t.common.loading}</p>
        ) : account.error ? (
          <p className="text-red-600">{errorText(account.error)}</p>
        ) : (
          <AppRoutes member={member} />
        )}
      </main>
    </div>
  );
}

/** Everyone can upload; a guest sees their one letter; everything else asks to sign in */
function AppRoutes({ member }: { member: boolean }) {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const membersOnly = (page: ReactNode) => (member ? page : <SignInRequired />);

  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/documents" element={membersOnly(<DocumentsPage />)} />
      <Route path="/documents/:id" element={<DocumentDetailPage />} />
      <Route path="/reminders" element={membersOnly(<RemindersPage />)} />
      <Route path="/usage" element={membersOnly(<UsagePage />)} />
      <Route path="/profile" element={membersOnly(<ProfilePage />)} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      {/* Once signed in: back to the page that asked for it */}
      <Route path="/login" element={member ? <Navigate to={from} replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={member ? <Navigate to={from} replace /> : <AuthPage mode="register" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Navigation({ member }: { member: boolean }) {
  const { t } = useI18n();
  return (
    <nav className="flex gap-1">
      <NavLink to="/" end className={navClass}>
        {t.app.nav.upload}
      </NavLink>
      <NavLink to="/documents" className={navClass}>
        {t.app.nav.documents}
      </NavLink>
      <NavLink to="/reminders" className={navClass}>
        {t.app.nav.reminders}
        {member && <DueReminders />}
      </NavLink>
      <NavLink to="/usage" className={navClass}>
        {t.app.nav.usage}
      </NavLink>
      {member && (
        <NavLink to="/profile" className={navClass}>
          {t.app.nav.profile}
        </NavLink>
      )}
    </nav>
  );
}

function DueReminders() {
  const { t } = useI18n();
  const count = useDueReminderCount();
  if (count === 0) return null;
  return (
    <span
      className="ms-1.5 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white"
      aria-label={t.app.dueReminders(count)}
    >
      {count}
    </span>
  );
}

function LanguageSelect() {
  const { t, language, setLanguage } = useI18n();
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      aria-label={t.app.language}
      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
    >
      {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
        <option key={code} value={code} lang={code}>
          {name}
        </option>
      ))}
    </select>
  );
}

function SignOutButton() {
  const { t } = useI18n();
  const signOut = useSignOut();
  return (
    <button
      type="button"
      onClick={() => signOut.mutate()}
      disabled={signOut.isPending}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
    >
      {t.auth.logout}
    </button>
  );
}
