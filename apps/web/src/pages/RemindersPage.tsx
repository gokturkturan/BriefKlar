import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { REMINDER_NOTE_MAX_LENGTH, type ReminderDto, type RemindersDto } from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

/** Reminders whose day has come, for the badge in the header */
export function useDueReminderCount(): number {
  const { data } = useQuery({
    queryKey: queryKeys.reminders,
    queryFn: api.listReminders,
    // The worker fires reminders on a schedule; check now and then
    refetchInterval: 60_000,
  });
  return data?.due.length ?? 0;
}

/** Today in Germany as YYYY-MM-DD, the earliest date a reminder can have */
function todayInGermany(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

function ReminderItem({ reminder }: { reminder: ReminderDto }) {
  const { t, formatDate } = useI18n();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.reminders });

  const done = useMutation({ mutationFn: () => api.updateReminder(reminder.id, true), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.deleteReminder(reminder.id), onSuccess: refresh });

  const title =
    reminder.origin === "DEADLINE" && reminder.dueDate
      ? t.reminders.deadline(
          reminder.deadlineKind ? t.analysis.deadlineKinds[reminder.deadlineKind] : t.analysis.deadlineKinds.OTHER,
          formatDate(reminder.dueDate, "weekday"),
        )
      : reminder.note;

  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-4 py-3 ${
        reminder.due ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-slate-900" dir="auto">
          {title}
        </p>
        <p className="text-sm text-slate-500">
          {t.reminders.remindOn(formatDate(reminder.remindOn))} · {t.reminders.origins[reminder.origin]}
          {reminder.document && (
            <>
              {" · "}
              <Link to={`/documents/${reminder.document.id}`} className="text-emerald-700 hover:underline">
                <bdi>{reminder.document.originalName}</bdi>
              </Link>
            </>
          )}
        </p>
        {(done.error || remove.error) && (
          <p className="text-sm text-red-600">{errorText(done.error ?? remove.error)}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => done.mutate()}
          disabled={done.isPending}
          className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t.reminders.markDone}
        </button>
        {/* Deadline reminders come back when the deadline is recalculated, so they can only be marked done */}
        {reminder.origin !== "DEADLINE" && (
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="text-slate-500 hover:text-red-600"
          >
            {t.common.delete}
          </button>
        )}
      </div>
    </li>
  );
}

function AddReminderForm() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const today = todayInGermany();
  const [remindOn, setRemindOn] = useState(today);
  const [note, setNote] = useState("");
  const [documentId, setDocumentId] = useState("");
  const documents = useQuery({ queryKey: queryKeys.documents, queryFn: api.listDocuments });

  const create = useMutation({
    mutationFn: () => api.createReminder({ remindOn, note, documentId: documentId || null }),
    onSuccess: () => {
      setNote("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.reminders });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (note.trim()) create.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">{t.reminders.add}</h2>
      <label className="block text-sm">
        <span className="text-slate-600">{t.reminders.note}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={REMINDER_NOTE_MAX_LENGTH}
          required
          dir="auto"
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="block text-slate-600">{t.reminders.date}</span>
          <input
            type="date"
            value={remindOn}
            min={today}
            onChange={(e) => setRemindOn(e.target.value)}
            required
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="min-w-0 flex-1 text-sm">
          <span className="block text-slate-600">{t.reminders.letter}</span>
          <select
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5"
          >
            <option value="">{t.reminders.noLetter}</option>
            {documents.data?.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.originalName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={create.isPending || !note.trim()}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {create.isPending ? t.common.saving : t.reminders.save}
        </button>
        {create.error && <span className="text-sm text-red-600">{errorText(create.error)}</span>}
      </div>
    </form>
  );
}

function ReminderList({ title, reminders }: { title: string; reminders: ReminderDto[] }) {
  if (reminders.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <ul className="space-y-2">
        {reminders.map((reminder) => (
          <ReminderItem key={reminder.id} reminder={reminder} />
        ))}
      </ul>
    </section>
  );
}

export function RemindersPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const { data, isLoading, error } = useQuery<RemindersDto>({
    queryKey: queryKeys.reminders,
    queryFn: api.listReminders,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.reminders.title}</h1>
        <p className="mt-1 text-slate-600">{t.reminders.intro}</p>
      </div>

      {isLoading && <p className="text-slate-500">{t.common.loading}</p>}
      {error && <p className="text-red-600">{errorText(error)}</p>}
      {data && data.due.length === 0 && data.upcoming.length === 0 && (
        <p className="text-slate-500">{t.reminders.empty}</p>
      )}
      {data && (
        <>
          <ReminderList title={t.reminders.due} reminders={data.due} />
          <ReminderList title={t.reminders.upcoming} reminders={data.upcoming} />
        </>
      )}

      <AddReminderForm />
    </div>
  );
}
