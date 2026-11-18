import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api, queryKeys } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function DocumentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.documents,
    queryFn: api.listDocuments,
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-red-600">{error.message}</p>;

  if (!data?.length) {
    return (
      <div className="text-center text-slate-600">
        <p>No letters yet.</p>
        <Link to="/" className="mt-2 inline-block font-medium text-emerald-700 hover:underline">
          Upload your first letter
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">My letters</h1>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {data.map((doc) => (
          <li key={doc.id}>
            <Link
              to={`/documents/${doc.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.originalName}</p>
                <p className="text-sm text-slate-500">{dateFormat.format(new Date(doc.createdAt))}</p>
              </div>
              <StatusBadge status={doc.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
