import type {
  ApiErrorBody,
  CreateReplyDraftInput,
  DocumentDetailDto,
  DocumentDto,
  HealthDto,
  ReplyDraftDto,
} from "@briefklar/shared";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(body?.error.message ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listDocuments: () => request<DocumentDto[]>("/api/documents"),

  getDocument: (id: string) => request<DocumentDetailDto>(`/api/documents/${id}`),

  deleteDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  getHealth: () => request<HealthDto>("/api/health"),

  retryDocument: (id: string) =>
    request<DocumentDto>(`/api/documents/${id}/retry`, { method: "POST" }),

  updateActionItem: (documentId: string, itemId: string, done: boolean) =>
    request<void>(`/api/documents/${documentId}/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }),

  listReplyDrafts: (documentId: string) =>
    request<ReplyDraftDto[]>(`/api/documents/${documentId}/reply-drafts`),

  createReplyDraft: (documentId: string, input: CreateReplyDraftInput) =>
    request<ReplyDraftDto>(`/api/documents/${documentId}/reply-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  updateReplyDraft: (documentId: string, draftId: string, contentDe: string) =>
    request<void>(`/api/documents/${documentId}/reply-drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentDe }),
    }),

  deleteReplyDraft: (documentId: string, draftId: string) =>
    request<void>(`/api/documents/${documentId}/reply-drafts/${draftId}`, { method: "DELETE" }),

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentDto>("/api/documents", { method: "POST", body: form });
  },

  fileUrl: (id: string) => `/api/documents/${id}/file`,
  eventsUrl: (id: string) => `/api/documents/${id}/events`,
  explanationUrl: (id: string, language: string) =>
    `/api/documents/${id}/explanation?language=${encodeURIComponent(language)}`,
};

export const queryKeys = {
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  replyDrafts: (id: string) => ["documents", id, "reply-drafts"] as const,
  health: ["health"] as const,
};
