import { Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { EXPLANATION_LANGUAGES } from "@briefklar/shared";
import { useAccount, useSignOut } from "./hooks/useAccount";
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
  const signedIn = Boolean(account.data);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* The brand name reads left to right in every language */}
          <NavLink to="/" dir="ltr" className="text-lg font-semibold tracking-tight">
            Brief<span className="text-emerald-600">Klar</span>
          </NavLink>
          <div className="flex flex-wrap items-center gap-3">
            {signedIn && <Navigation />}
            <LanguageSelect />
            {signedIn && <SignOutButton />}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {account.isPending ? (
          <p className="text-slate-500">{t.common.loading}</p>
        ) : account.error ? (
          <p className="text-red-600">{errorText(account.error)}</p>
        ) : signedIn ? (
          <SignedInRoutes />
        ) : (
          <SignedOutRoutes />
        )}
      </main>
    </div>
  );
}

function SignedInRoutes() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/documents/:id" element={<DocumentDetailPage />} />
      <Route path="/reminders" element={<RemindersPage />} />
      <Route path="/usage" element={<UsagePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      {/* Just signed in: back to the page that asked for it */}
      <Route path="/login" element={<Navigate to={from} replace />} />
      <Route path="/register" element={<Navigate to={from} replace />} />
    </Routes>
  );
}

function SignedOutRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="*"
        element={<Navigate to="/login" replace state={{ from: location.pathname + location.search }} />}
      />
    </Routes>
  );
}

function Navigation() {
  const { t } = useI18n();
  const dueReminders = useDueReminderCount();
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
        {dueReminders > 0 && (
          <span
            className="ms-1.5 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white"
            aria-label={t.app.dueReminders(dueReminders)}
          >
            {dueReminders}
          </span>
        )}
      </NavLink>
      <NavLink to="/usage" className={navClass}>
        {t.app.nav.usage}
      </NavLink>
      <NavLink to="/profile" className={navClass}>
        {t.app.nav.profile}
      </NavLink>
    </nav>
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
