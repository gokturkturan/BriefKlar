import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { api, queryKeys } from "../api/client";
import { useSettings } from "../hooks/useSettings";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

/** Local calendar day as YYYY-MM-DD, the latest date a letter can have arrived */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * The delivery date the user enters replaces the assumed one, and the API calculates the
 * deadlines again. Also points to the settings while the federal state is unknown.
 */
export function ReceivedDateForm({
  documentId,
  receivedDate,
  letterDate,
}: {
  documentId: string;
  receivedDate: string | null;
  letterDate: string | null;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [value, setValue] = useState(receivedDate ?? "");

  const save = useMutation({
    mutationFn: (date: string | null) => api.updateDocument(documentId, { receivedDate: date }),
    // Refetches the document with the new due dates
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.document(documentId) }),
  });

  return (
    <div className="mt-3 space-y-2 rounded-md bg-slate-50 px-3 py-3 text-sm">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(value || null);
        }}
      >
        <label htmlFor={`received-${documentId}`} className="text-slate-700">
          {t.receivedDate.question}
        </label>
        <input
          id={`received-${documentId}`}
          type="date"
          value={value}
          min={letterDate ?? undefined}
          max={today()}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1"
        />
        <button
          type="submit"
          disabled={save.isPending || value === (receivedDate ?? "")}
          className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {save.isPending ? t.common.saving : t.receivedDate.use}
        </button>
        {receivedDate && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              save.mutate(null);
            }}
            className="text-slate-600 hover:underline"
          >
            {t.common.remove}
          </button>
        )}
      </form>
      <p className="text-slate-500">{t.receivedDate.hint}</p>
      {save.error && <p className="text-red-600">{errorText(save.error)}</p>}
      {settings.data && settings.data.state === null && (
        <p className="text-slate-500">
          {t.receivedDate.noState}{" "}
          <Link to="/profile" className="font-medium text-emerald-700 hover:underline">
            {t.receivedDate.setState}
          </Link>
        </p>
      )}
    </div>
  );
}
