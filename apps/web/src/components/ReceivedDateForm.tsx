import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { api, queryKeys } from "../api/client";
import { useSettings } from "../hooks/useSettings";

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
          When did the letter arrive?
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
          {save.isPending ? "Saving…" : "Use this date"}
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
            Remove
          </button>
        )}
      </form>
      <p className="text-slate-500">
        Deadlines that start on delivery are then counted from this day instead of an assumed date.
        For a yellow envelope (Zustellung), use the date written on it.
      </p>
      {save.error && <p className="text-red-600">{save.error.message}</p>}
      {settings.data && settings.data.state === null && (
        <p className="text-slate-500">
          Public holidays of your federal state are not included yet.{" "}
          <Link to="/settings" className="font-medium text-emerald-700 hover:underline">
            Set your state
          </Link>
        </p>
      )}
    </div>
  );
}
