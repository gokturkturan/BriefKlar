import { NavLink, Route, Routes } from "react-router";
import { EXPLANATION_LANGUAGES } from "@briefklar/shared";
import { useChangeLanguage } from "./hooks/useSettings";
import { useI18n } from "./i18n/I18nProvider";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export function App() {
  const { t, language } = useI18n();
  const changeLanguage = useChangeLanguage();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* The brand name reads left to right in every language */}
          <NavLink to="/" dir="ltr" className="text-lg font-semibold tracking-tight">
            Brief<span className="text-emerald-600">Klar</span>
          </NavLink>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex gap-1">
              <NavLink to="/" end className={navClass}>
                {t.app.nav.upload}
              </NavLink>
              <NavLink to="/documents" className={navClass}>
                {t.app.nav.documents}
              </NavLink>
              <NavLink to="/settings" className={navClass}>
                {t.app.nav.settings}
              </NavLink>
            </nav>
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              aria-label={t.app.language}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code} lang={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
