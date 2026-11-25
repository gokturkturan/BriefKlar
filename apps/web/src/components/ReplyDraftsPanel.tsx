import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  EXPLANATION_LANGUAGES,
  REPLY_TYPE_HINTS,
  REPLY_TYPE_LABELS,
  REPLY_TYPES,
  RTL_LANGUAGES,
  type ReplyDraftDto,
  type ReplyType,
} from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { usePreferredLanguage } from "../hooks/usePreferredLanguage";

/** Reply types that make sense for this letter come first */
function suggestedType(objectionPossible: boolean, hasDocuments: boolean): ReplyType {
  if (objectionPossible) return "OBJECTION";
  if (hasDocuments) return "SEND_DOCUMENTS";
  return "QUESTION";
}

function DraftCard({ documentId, draft }: { documentId: string; draft: ReplyDraftDto }) {
  const queryClient = useQueryClient();
  const key = queryKeys.replyDrafts(documentId);
  const [text, setText] = useState(draft.contentDe);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = text !== draft.contentDe;

  const save = useMutation({
    mutationFn: () => api.updateReplyDraft(documentId, draft.id, text),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteReplyDraft(documentId, draft.id),
    onSuccess: () =>
      queryClient.setQueryData<ReplyDraftDto[]>(key, (old) => old?.filter((d) => d.id !== draft.id)),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the text can still be selected by hand
    }
  };

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-900">{REPLY_TYPE_LABELS[draft.type]}</p>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={() => void copy()} className="font-medium text-emerald-700 hover:underline">
            {copied ? "Copied" : "Copy German text"}
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="font-medium text-red-600 hover:underline"
              >
                Delete draft
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-slate-500 hover:underline">
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-slate-500 hover:text-red-600">
              Delete
            </button>
          )}
        </div>
      </div>

      {draft.warnings.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {draft.warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        lang="de"
        spellCheck
        aria-label="German reply letter"
        className="w-full rounded-md border border-slate-300 p-3 font-mono text-sm leading-relaxed"
      />
      {dirty && (
        <div className="mt-2 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => setText(draft.contentDe)} className="text-slate-600 hover:underline">
            Undo changes
          </button>
          {save.error && <span className="text-red-600">{save.error.message}</span>}
        </div>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-600">
          What it says ({EXPLANATION_LANGUAGES[draft.language]})
        </summary>
        <p
          className="mt-2 whitespace-pre-line text-slate-700"
          dir={RTL_LANGUAGES.includes(draft.language) ? "rtl" : "ltr"}
          lang={draft.language}
        >
          {draft.contentUserLanguage}
        </p>
      </details>
    </li>
  );
}

export function ReplyDraftsPanel({
  documentId,
  objectionPossible,
  hasDocuments,
}: {
  documentId: string;
  objectionPossible: boolean;
  hasDocuments: boolean;
}) {
  const queryClient = useQueryClient();
  const key = queryKeys.replyDrafts(documentId);
  const [type, setType] = useState<ReplyType>(() => suggestedType(objectionPossible, hasDocuments));
  const [notes, setNotes] = useState("");
  const [language, changeLanguage] = usePreferredLanguage();

  const drafts = useQuery({ queryKey: key, queryFn: () => api.listReplyDrafts(documentId) });

  const create = useMutation({
    mutationFn: () => api.createReplyDraft(documentId, { type, notes, language }),
    onSuccess: (draft) => {
      queryClient.setQueryData<ReplyDraftDto[]>(key, (old) => [draft, ...(old ?? [])]);
      setNotes("");
    },
  });

  const notesRequired = type === "QUESTION";

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3 rounded-lg bg-slate-50 p-4"
      >
        <div className="flex flex-wrap gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReplyType)}
            aria-label="Type of reply"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {REPLY_TYPES.map((t) => (
              <option key={t} value={t}>
                {REPLY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            aria-label="Language of the translation"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                Translation: {name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          required={notesRequired}
          placeholder={REPLY_TYPE_HINTS[type] + " You can write in your own language."}
          aria-label="Your notes for the reply"
          className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={create.isPending || (notesRequired && notes.trim() === "")}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {create.isPending ? "Writing the draft…" : "Write a German draft"}
          </button>
          {create.error && <span className="text-sm text-red-600">{create.error.message}</span>}
        </div>
      </form>

      {drafts.error && <p className="text-sm text-red-600">{drafts.error.message}</p>}
      {drafts.data && drafts.data.length > 0 && (
        <ul className="space-y-3">
          {drafts.data.map((draft) => (
            <DraftCard key={draft.id} documentId={documentId} draft={draft} />
          ))}
        </ul>
      )}
    </div>
  );
}
