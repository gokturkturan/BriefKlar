import { Link } from "react-router";
import { EXPLANATION_LANGUAGES } from "@briefklar/shared";
import { useI18n } from "../i18n/I18nProvider";

/** Outline icons (24×24, stroke) for the feature cards, in the order of t.landing.features.items */
const FEATURE_ICONS = [
  // Explanation: speech bubble with lines
  "M7.5 8.25h9m-9 3h6M21 12c0 4.556-4.03 8.25-9 8.25a9.8 9.8 0 0 1-2.555-.337A5.97 5.97 0 0 1 5.41 20.97a5.97 5.97 0 0 1-.474-.065 4.5 4.5 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z",
  // Deadlines: calendar with check
  "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-12-3 2.25 2.25L15 13.5",
  // Replies: pencil on paper
  "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  // Questions: magnifier
  "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  // Reminders: bell
  "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
  // Languages: globe
  "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
];

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-emerald-700";
const secondaryButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-800 hover:bg-slate-100";

/** The start page for visitors: what BriefKlar does, and a way to try it */
export function LandingPage() {
  const { t } = useI18n();
  const texts = t.landing;

  return (
    <div className="space-y-24 pb-8">
      <section className="grid items-center gap-12 pt-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{texts.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{texts.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">{texts.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/upload" className={primaryButton}>
              {texts.tryCta}
            </Link>
            <Link to="/register" className={secondaryButton}>
              {texts.registerCta}
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">{texts.ctaNote}</p>
        </div>
        <SampleAnalysis />
      </section>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{texts.how.title}</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {texts.how.steps.map((step, i) => (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{texts.features.title}</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {texts.features.items.map((feature, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon path={FEATURE_ICONS[i] ?? FEATURE_ICONS[0]} />
              </span>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.text}</p>
            </div>
          ))}
        </div>
        <ul className="mt-6 flex flex-wrap gap-2" aria-label={texts.languages}>
          {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
            <li key={code} lang={code} className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700">
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-8 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{texts.privacy.title}</h2>
          <p className="mt-3 text-slate-600">{texts.privacy.intro}</p>
        </div>
        <ul className="space-y-3">
          {texts.privacy.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-slate-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-slate-900 px-8 py-12 text-center text-white">
        <h2 className="text-3xl font-semibold tracking-tight">{texts.final.title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">{texts.final.text}</p>
        <Link to="/upload" className={`${primaryButton} mt-8`}>
          {texts.tryCta}
        </Link>
      </section>

      <p className="text-center text-xs text-slate-500">{t.upload.disclaimer}</p>
    </div>
  );
}

/** A made-up analysis, drawn like the real analysis panel, so visitors see what they get */
function SampleAnalysis() {
  const { t, formatDate, formatMoney } = useI18n();
  const sample = t.landing.sample;

  return (
    <div className="relative" aria-label={sample.label}>
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-emerald-100 via-slate-100 to-amber-50" />
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {t.analysis.urgency.MEDIUM}
          </span>
          <span className="text-xs text-slate-500">{t.analysis.letterTypes.BESCHEID}</span>
        </div>
        <div>
          <p className="text-lg font-semibold" dir="ltr">
            Einkommensteuerbescheid 2025
          </p>
          <p className="text-sm text-slate-500">
            <bdi>Finanzamt Köln-Mitte</bdi> · {formatDate("2027-01-12")}
          </p>
        </div>
        <p className="leading-relaxed text-slate-800">{sample.summary(formatMoney(312.4, "EUR"))}</p>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">{sample.deadline}</p>
          <p className="mt-1 font-semibold text-slate-900">{formatDate("2027-02-15", "weekday")}</p>
          <p className="mt-0.5 text-xs text-slate-600">{sample.deadlineHint}</p>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          {sample.todos.map((todo, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={`h-4 w-4 shrink-0 rounded border ${i === 0 ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`} />
              <span className={i === 0 ? "text-slate-400 line-through" : ""}>{todo}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
