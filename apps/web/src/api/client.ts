import type { ApiErrorBody, DocumentDto } from "@briefklar/shared";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(body?.error.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listDocuments: () => request<DocumentDto[]>("/api/documents"),

  getDocument: (id: string) => request<DocumentDto>(`/api/documents/${id}`),

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentDto>("/api/documents", { method: "POST", body: form });
  },

  fileUrl: (id: string) => `/api/documents/${id}/file`,
  eventsUrl: (id: string) => `/api/documents/${id}/events`,
};

export const queryKeys = {
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
};
