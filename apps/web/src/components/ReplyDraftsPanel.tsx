import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  EXPLANATION_LANGUAGES,
  REPLY_TYPES,
  type ReplyDraftDto,
  type ReplyType,
  type ReplyWarning,
} from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { usePanelLanguage } from "../hooks/useSettings";
import { useErrorText } from "../i18n/errors";
import { dirOf, useI18n, type I18n } from "../i18n/I18nProvider";
import { replyDraftElementId } from "./replyDraftAnchor";

/** Reply types that make sense for this letter come first */
function suggestedType(objectionPossible: boolean, hasDocuments: boolean): ReplyType {
  if (objectionPossible) return "OBJECTION";
  if (hasDocuments) return "SEND_DOCUMENTS";
  return "QUESTION";
}

function warningText({ t, formatDate }: I18n, warning: ReplyWarning): string {
  const texts = t.replies.warnings;
  switch (warning.code) {
    case "NO_OBJECTION_RIGHT":
      return texts.NO_OBJECTION_RIGHT();
    case "OBJECTION_DEADLINE_PASSED":
      return texts.OBJECTION_DEADLINE_PASSED(formatDate(warning.date));
    case "OBJECTION_DEADLINE":
      return texts.OBJECTION_DEADLINE(formatDate(warning.date));
    case "REQUEST_ONLY":
      return texts.REQUEST_ONLY();
    case "FILL_PLACEHOLDERS":
      return texts.FILL_PLACEHOLDERS(warning.placeholders.join(", "));
  }
}

function DraftCard({ documentId, draft }: { documentId: string; draft: ReplyDraftDto }) {
  const i18n = useI18n();
  const { t } = i18n;
  const errorText = useErrorText();
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
    <li id={replyDraftElementId(draft.id)} className="scroll-mt-4 rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-900">{t.replies.types[draft.type]}</p>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={() => void copy()} className="font-medium text-emerald-700 hover:underline">
            {copied ? t.replies.copied : t.replies.copy}
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="font-medium text-red-600 hover:underline"
              >
                {t.replies.deleteDraft}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-slate-500 hover:underline">
                {t.common.cancel}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-slate-500 hover:text-red-600">
              {t.common.delete}
            </button>
          )}
        </div>
      </div>

      {draft.warnings.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {draft.warnings.map((warning, i) => (
            <li key={i}>{warningText(i18n, warning)}</li>
          ))}
        </ul>
      )}

      {/* The letter itself is German, so it stays left to right on an Arabic page */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        lang="de"
        dir="ltr"
        spellCheck
        aria-label={t.replies.letter}
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
            {save.isPending ? t.common.saving : t.replies.save}
          </button>
          <button type="button" onClick={() => setText(draft.contentDe)} className="text-slate-600 hover:underline">
            {t.replies.undo}
          </button>
          {save.error && <span className="text-red-600">{errorText(save.error)}</span>}
        </div>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-600">
          {t.replies.whatItSays(EXPLANATION_LANGUAGES[draft.language])}
        </summary>
        <p className="mt-2 whitespace-pre-line text-slate-700" dir={dirOf(draft.language)} lang={draft.language}>
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
  const { t, language: siteLanguage } = useI18n();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const key = queryKeys.replyDrafts(documentId);
  const [type, setType] = useState<ReplyType>(() => suggestedType(objectionPossible, hasDocuments));
  const [notes, setNotes] = useState("");
  const [language, changeLanguage] = usePanelLanguage(siteLanguage);

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
            aria-label={t.replies.type}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {REPLY_TYPES.map((replyType) => (
              <option key={replyType} value={replyType}>
                {t.replies.types[replyType]}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            aria-label={t.replies.translationLanguage}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {Object.entries(EXPLANATION_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {t.replies.translationOption(name)}
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
          dir="auto"
          placeholder={`${t.replies.hints[type]} ${t.replies.ownLanguage}`}
          aria-label={t.replies.notes}
          className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={create.isPending || (notesRequired && notes.trim() === "")}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {create.isPending ? t.replies.writing : t.replies.write}
          </button>
          {create.error && <span className="text-sm text-red-600">{errorText(create.error)}</span>}
        </div>
      </form>

      {drafts.error && <p className="text-sm text-red-600">{errorText(drafts.error)}</p>}
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
