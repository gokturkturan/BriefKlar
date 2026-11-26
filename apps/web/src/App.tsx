import { NavLink, Route, Routes } from "react-router";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="text-lg font-semibold tracking-tight">
            Brief<span className="text-emerald-600">Klar</span>
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>
              Upload
            </NavLink>
            <NavLink to="/documents" className={navClass}>
              My letters
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
          </nav>
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
