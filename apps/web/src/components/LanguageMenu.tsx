import { useEffect, useRef, useState } from "react";
import { EXPLANATION_LANGUAGES, type ExplanationLanguage } from "@briefklar/shared";
import { useI18n } from "../i18n/I18nProvider";

const LANGUAGES = Object.entries(EXPLANATION_LANGUAGES) as [ExplanationLanguage, string][];

/** The site language in the header: a small globe button with a menu of the languages in their own names */
export function LanguageMenu() {
  const { t, language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A click outside or Escape closes the menu
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.app.language}: ${EXPLANATION_LANGUAGES[language]}`}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3M3.6 9h16.8M3.6 15h16.8"
          />
        </svg>
        <span className="uppercase" dir="ltr">
          {language}
        </span>
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute end-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {LANGUAGES.map(([code, name]) => (
            <li key={code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={code === language}
                lang={code}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-start text-sm hover:bg-slate-100 ${
                  code === language ? "font-medium text-slate-900" : "text-slate-700"
                }`}
              >
                <span>{name}</span>
                {code === language && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-600" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
