import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { isTerminalStatus, PROCESSING_STEP_LABELS } from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useDocumentEvents } from "../hooks/useDocumentEvents";

export function DocumentDetailPage() {
  const { id = "" } = useParams();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: queryKeys.document(id),
    queryFn: () => api.getDocument(id),
    enabled: Boolean(id),
  });

  const isProcessing = doc ? !isTerminalStatus(doc.status) : false;
  const lastEvent = useDocumentEvents(id, isProcessing);

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-red-600">{error.message}</p>;
  if (!doc) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{doc.originalName}</h1>
        <StatusBadge status={doc.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {doc.mimeType === "application/pdf" ? (
            <iframe src={api.fileUrl(doc.id)} title="Original letter" className="h-[70vh] w-full" />
          ) : (
            <img src={api.fileUrl(doc.id)} alt="Original letter" className="w-full" />
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          {isProcessing && (
            <div className="flex items-center gap-3 text-slate-700">
              <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
              <span>{lastEvent?.step ? PROCESSING_STEP_LABELS[lastEvent.step] : "Waiting in queue…"}</span>
            </div>
          )}

          {doc.status === "FAILED" && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              Processing failed: {doc.errorMessage ?? "unknown error"}
            </p>
          )}

          {doc.status === "DONE" && (
            <div className="text-slate-600">
              <h2 className="mb-2 font-semibold text-slate-900">Explanation</h2>
              <p>The analysis (summary, deadlines and next steps) will appear here in week 2.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
