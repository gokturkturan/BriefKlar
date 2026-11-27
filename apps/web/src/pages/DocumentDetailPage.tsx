import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { isTerminalStatus, type DocumentDetailDto } from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { StatusBadge } from "../components/StatusBadge";
import { useDocumentEvents } from "../hooks/useDocumentEvents";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

export function DocumentDetailPage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const errorText = useErrorText();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: queryKeys.document(id),
    queryFn: () => api.getDocument(id),
    enabled: Boolean(id),
  });

  const isProcessing = doc ? !isTerminalStatus(doc.status) : false;
  const lastEvent = useDocumentEvents(id, isProcessing);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // While processing, check that a background worker is actually running
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: api.getHealth,
    enabled: isProcessing,
    refetchInterval: 10_000,
  });
  const noWorker = isProcessing && health.data?.workers === 0;

  const remove = useMutation({
    mutationFn: () => api.deleteDocument(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.document(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      void navigate("/documents");
    },
  });

  const retry = useMutation({
    mutationFn: () => api.retryDocument(id),
    onSuccess: (updated) => {
      // Back to a non-terminal status: useDocumentEvents reconnects to the SSE stream
      queryClient.setQueryData<DocumentDetailDto>(queryKeys.document(id), (old) =>
        old ? { ...old, ...updated, analysis: null } : old,
      );
    },
  });

  const retryButton = (
    <button
      type="button"
      onClick={() => retry.mutate()}
      disabled={retry.isPending}
      className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
    >
      {retry.isPending ? t.common.starting : t.common.tryAgain}
    </button>
  );

  if (isLoading) return <p className="text-slate-500">{t.common.loading}</p>;
  if (error) return <p className="text-red-600">{errorText(error)}</p>;
  if (!doc) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-semibold tracking-tight" dir="auto">
          {doc.originalName}
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status={doc.status} />
          {!isProcessing &&
            (confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {remove.isPending ? t.detail.deleting : t.detail.deletePermanently}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-slate-600 hover:underline"
                >
                  {t.common.cancel}
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-slate-500 hover:text-red-600"
              >
                {t.common.delete}
              </button>
            ))}
        </div>
      </div>

      {remove.error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorText(remove.error)}</p>
      )}
      {retry.error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorText(retry.error)}</p>
      )}

      {noWorker && (
        <p className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.detail.noWorkerBefore}{" "}
          <code className="font-mono" dir="ltr">
            npm run dev
          </code>
          {t.detail.noWorkerAfter}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {doc.mimeType === "application/pdf" ? (
            <iframe src={api.fileUrl(doc.id)} title={t.detail.originalLetter} className="h-[70vh] w-full" />
          ) : (
            <img src={api.fileUrl(doc.id)} alt={t.detail.originalLetter} className="w-full" />
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:max-h-[70vh] lg:overflow-y-auto">
          {isProcessing && (
            <div className="flex items-center gap-3 text-slate-700">
              <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
              <span>
                {lastEvent?.step
                  ? t.processing[lastEvent.step]
                  : doc.status === "PROCESSING"
                    ? t.processing.processing
                    : t.processing.queued}
              </span>
            </div>
          )}

          {doc.status === "FAILED" && (
            <div>
              <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                {doc.errorCode || doc.errorMessage
                  ? errorText(new Error(doc.errorMessage ?? ""), doc.errorCode)
                  : t.detail.failed}
              </p>
              {retryButton}
            </div>
          )}

          {doc.status === "DONE" &&
            (doc.analysis ? (
              <AnalysisPanel documentId={doc.id} analysis={doc.analysis} receivedDate={doc.receivedDate} />
            ) : (
              <div>
                <p className="text-slate-500">{t.detail.noAnalysis}</p>
                {retryButton}
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}
