import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { USAGE_PERIODS, type UsageGroupDto, type UsagePeriod } from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

/** Costs per call are fractions of a cent, so they get more decimals than amounts in letters */
function useFormatters() {
  const { locale } = useI18n();
  const usd = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    }).format(value);
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const compact = (value: number) => new Intl.NumberFormat(locale, { notation: "compact" }).format(value);
  const seconds = (ms: number | null) =>
    ms === null ? "–" : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(ms / 1000)} s`;
  return { usd, count, compact, seconds };
}

function Tile({ label, value, detail, hint }: { label: string; value: string; detail?: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" title={hint}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function GroupTable({ title, rows, label }: { title: string; rows: UsageGroupDto[]; label: (row: UsageGroupDto) => ReactNode }) {
  const { t } = useI18n();
  const f = useFormatters();
  const columns = t.usage.columns;
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-start text-slate-500">
            <tr>
              <th className="px-4 py-2 text-start font-medium">{columns.name}</th>
              <th className="px-4 py-2 text-end font-medium">{columns.calls}</th>
              <th className="px-4 py-2 text-end font-medium">{columns.failed}</th>
              <th className="px-4 py-2 text-end font-medium">{columns.switches}</th>
              <th className="px-4 py-2 text-end font-medium">{columns.tokens}</th>
              <th className="px-4 py-2 text-end font-medium">{columns.latency}</th>
              <th className="px-4 py-2 text-end font-medium">{columns.cost}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="px-4 py-2">{label(row)}</td>
                <td className="px-4 py-2 text-end">{f.count(row.calls)}</td>
                <td className={`px-4 py-2 text-end ${row.failedCalls > 0 ? "text-red-600" : ""}`}>{f.count(row.failedCalls)}</td>
                <td className={`px-4 py-2 text-end ${row.fallbackSwitches > 0 ? "text-amber-600" : ""}`}>
                  {f.count(row.fallbackSwitches)}
                </td>
                <td className="px-4 py-2 text-end" dir="ltr">
                  {f.compact(row.inputTokens)} / {f.compact(row.outputTokens)}
                </td>
                <td className="px-4 py-2 text-end" dir="ltr">
                  {f.seconds(row.p50LatencyMs)} / {f.seconds(row.p95LatencyMs)}
                </td>
                <td className="px-4 py-2 text-end">{f.usd(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One bar per day; the height is the day's cost, the title shows the numbers */
function CostPerDay({ days }: { days: { date: string; calls: number; failedCalls: number; costUsd: number }[] }) {
  const { t, formatDate } = useI18n();
  const f = useFormatters();
  const max = Math.max(...days.map((day) => day.costUsd), 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{t.usage.perDay}</h2>
      {/* Time runs left to right in every language */}
      <div dir="ltr" className="flex h-32 items-end gap-px">
        {days.map((day) => (
          <div
            key={day.date}
            className="flex h-full flex-1 items-end"
            title={`${formatDate(day.date)}: ${f.usd(day.costUsd)} · ${t.usage.calls} ${f.count(day.calls)}${
              day.failedCalls > 0 ? ` · ${t.usage.failed(day.failedCalls)}` : ""
            }`}
          >
            <div
              className={`w-full rounded-t-sm ${day.failedCalls > 0 ? "bg-amber-400" : "bg-emerald-500"}`}
              style={{ height: max > 0 ? `${Math.max((day.costUsd / max) * 100, day.calls > 0 ? 2 : 0)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div dir="ltr" className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{formatDate(days[0].date)}</span>
        <span>{formatDate(days[days.length - 1].date)}</span>
      </div>
    </section>
  );
}

export function UsagePage() {
  const { t, formatDate, formatDateTime } = useI18n();
  const errorText = useErrorText();
  const f = useFormatters();
  const [days, setDays] = useState<UsagePeriod>(30);
  const usage = useQuery({ queryKey: queryKeys.usage(days), queryFn: () => api.getUsage(days) });
  const data = usage.data;
  const purposeName = (key: string) => t.usage.purposes[key] ?? key;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.usage.title}</h1>
          {data && <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.usage.intro(formatDate(data.pricesCheckedOn))}</p>}
        </div>
        <div className="flex gap-1" role="group">
          {USAGE_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDays(period)}
              aria-pressed={days === period}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                days === period ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t.usage.period(period)}
            </button>
          ))}
        </div>
      </div>

      {usage.isLoading && <p className="text-slate-500">{t.common.loading}</p>}
      {usage.error && <p className="text-red-600">{errorText(usage.error)}</p>}

      {data && data.totals.calls === 0 && <p className="text-slate-500">{t.usage.empty}</p>}

      {data && data.totals.calls > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile label={t.usage.cost} value={f.usd(data.totals.costUsd)} />
            <Tile
              label={t.usage.calls}
              value={f.count(data.totals.calls)}
              detail={data.totals.failedCalls > 0 ? t.usage.failed(data.totals.failedCalls) : undefined}
            />
            <Tile
              label={t.usage.fallbackSwitches}
              value={f.count(data.totals.fallbackSwitches)}
              detail={t.usage.fallbackHint}
            />
            <Tile
              label={t.usage.costPerLetter}
              value={data.totals.costPerLetterUsd === null ? "–" : f.usd(data.totals.costPerLetterUsd)}
              detail={t.usage.letters(data.totals.letters)}
            />
            <Tile
              label={t.usage.latency}
              value={`${f.seconds(data.totals.p50LatencyMs)} / ${f.seconds(data.totals.p95LatencyMs)}`}
            />
            <Tile
              label={t.usage.tokens}
              value={`${f.compact(data.totals.inputTokens)} / ${f.compact(data.totals.outputTokens)}`}
            />
          </div>

          <CostPerDay days={data.byDay} />

          <GroupTable title={t.usage.byPurpose} rows={data.byPurpose} label={(row) => purposeName(row.key)} />
          <GroupTable
            title={t.usage.byModel}
            rows={data.byModel}
            label={(row) => (
              <>
                <code className="text-xs">{row.key}</code>
                {!row.priced && <span className="ms-2 text-xs text-amber-600">{t.usage.unpriced}</span>}
              </>
            )}
          />

          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t.usage.recentFailures}</h2>
            {data.recentFailures.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">{t.usage.noFailures}</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.recentFailures.map((failure, index) => (
                  <li key={`${failure.createdAt}-${index}`} className="px-4 py-2">
                    <p>
                      <span className="text-slate-500">{formatDateTime(failure.createdAt)}</span>
                      {" · "}
                      {purposeName(failure.purpose)}
                      {" · "}
                      <code className="text-xs">{failure.model}</code>
                      {" · "}
                      <span dir="ltr">{f.seconds(failure.latencyMs)}</span>
                      {failure.switchedToFallback && (
                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{t.usage.switched}</span>
                      )}
                    </p>
                    {/* Provider errors are English log text */}
                    {failure.errorMessage && (
                      <p className="mt-0.5 break-words text-xs text-slate-500" dir="ltr" lang="en">
                        {failure.errorMessage}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
