import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { LanguageMenu } from "./components/LanguageMenu";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { SignInRequired } from "./components/SignInRequired";
import { useAccount, useIsMember, useSignOut } from "./hooks/useAccount";
import { useErrorText } from "./i18n/errors";
import { useI18n } from "./i18n/I18nProvider";
import { AuthPage } from "./pages/AuthPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { LandingPage } from "./pages/LandingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RemindersPage, useDueReminderCount } from "./pages/RemindersPage";
import { UploadPage } from "./pages/UploadPage";
import { UsagePage } from "./pages/UsagePage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
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
        {/* Phones: brand and the language and account buttons on top, the navigation below */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          {/* The brand name reads left to right in every language */}
          <NavLink to="/" dir="ltr" className="text-lg font-semibold tracking-tight">
            Brief<span className="text-emerald-600">Klar</span>
          </NavLink>
          <Navigation member={member} />
          <div className="order-2 ms-auto flex items-center gap-2 md:order-3 md:ms-0">
            <LanguageMenu />
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
          <PageErrorBoundary>
            <AppRoutes member={member} />
          </PageErrorBoundary>
        )}
      </main>
    </div>
  );
}

/** Visitors start on the landing page and can upload one letter; the rest asks to sign in */
function AppRoutes({ member }: { member: boolean }) {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const membersOnly = (page: ReactNode) => (member ? page : <SignInRequired />);

  return (
    <Routes>
      <Route path="/" element={member ? <Navigate to="/upload" replace /> : <LandingPage />} />
      <Route path="/upload" element={<UploadPage />} />
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
    <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-2 md:mx-0 md:ms-auto md:w-auto">
      <NavLink to="/upload" className={navClass}>
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
