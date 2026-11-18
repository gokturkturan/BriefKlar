import type { DocumentStatus } from "@briefklar/shared";

const styles: Record<DocumentStatus, string> = {
  UPLOADED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

const labels: Record<DocumentStatus, string> = {
  UPLOADED: "Queued",
  PROCESSING: "Processing",
  DONE: "Ready",
  FAILED: "Failed",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
