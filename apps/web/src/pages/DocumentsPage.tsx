import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api, queryKeys } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

export function DocumentsPage() {
  const { t, formatDateTime } = useI18n();
  const errorText = useErrorText();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.documents,
    queryFn: api.listDocuments,
  });

  if (isLoading) return <p className="text-slate-500">{t.common.loading}</p>;
  if (error) return <p className="text-red-600">{errorText(error)}</p>;

  if (!data?.length) {
    return (
      <div className="text-center text-slate-600">
        <p>{t.documents.empty}</p>
        <Link to="/upload" className="mt-2 inline-block font-medium text-emerald-700 hover:underline">
          {t.documents.uploadFirst}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t.documents.title}</h1>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {data.map((doc) => (
          <li key={doc.id}>
            <Link
              to={`/documents/${doc.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                {/* File names are usually German or Latin script */}
                <p className="truncate font-medium" dir="auto">
                  {doc.originalName}
                </p>
                <p className="text-sm text-slate-500">{formatDateTime(doc.createdAt)}</p>
              </div>
              <StatusBadge status={doc.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
