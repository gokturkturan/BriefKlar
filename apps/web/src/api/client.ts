import type {
  AccountDto,
  AnalysisTranslationDto,
  ChangePasswordInput,
  ApiErrorBody,
  ChatMessageDto,
  CreateReminderInput,
  CreateReplyDraftInput,
  DocumentDetailDto,
  DocumentDto,
  ErrorCode,
  ExplanationLanguage,
  HealthDto,
  LoginInput,
  RegisterInput,
  ReminderDto,
  RemindersDto,
  ReplyDraftDto,
  SettingsDto,
  UpdateAccountInput,
  UpdateDocumentInput,
  UpdateSettingsInput,
  UsageDto,
  UsagePeriod,
} from "@briefklar/shared";

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Error from the API; the web app shows its own text for the code */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: ErrorCode,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.error.message ?? `Request failed (${res.status})`, res.status, body?.error.code);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<HealthDto>("/api/health"),

  // Account (the session is a cookie the browser sends along)
  getAccount: () => request<AccountDto>("/api/auth/me"),
  register: (input: RegisterInput) => request<AccountDto>("/api/auth/register", json("POST", input)),
  login: (input: LoginInput) => request<AccountDto>("/api/auth/login", json("POST", input)),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  updateAccount: (input: UpdateAccountInput) => request<AccountDto>("/api/auth/me", json("PATCH", input)),
  changePassword: (input: ChangePasswordInput) => request<void>("/api/auth/password", json("POST", input)),

  // Letters
  listDocuments: () => request<DocumentDto[]>("/api/documents"),
  getDocument: (id: string) => request<DocumentDetailDto>(`/api/documents/${id}`),
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentDto>("/api/documents", { method: "POST", body: form });
  },
  updateDocument: (id: string, input: UpdateDocumentInput) =>
    request<DocumentDto>(`/api/documents/${id}`, json("PATCH", input)),
  retryDocument: (id: string) => request<DocumentDto>(`/api/documents/${id}/retry`, { method: "POST" }),
  deleteDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),
  updateActionItem: (documentId: string, itemId: string, done: boolean) =>
    request<void>(`/api/documents/${documentId}/action-items/${itemId}`, json("PATCH", { done })),
  getAnalysisTranslation: (id: string, language: ExplanationLanguage) =>
    request<AnalysisTranslationDto>(`/api/documents/${id}/translation?language=${encodeURIComponent(language)}`),

  // Reply drafts
  listReplyDrafts: (documentId: string) => request<ReplyDraftDto[]>(`/api/documents/${documentId}/reply-drafts`),
  createReplyDraft: (documentId: string, input: CreateReplyDraftInput) =>
    request<ReplyDraftDto>(`/api/documents/${documentId}/reply-drafts`, json("POST", input)),
  updateReplyDraft: (documentId: string, draftId: string, contentDe: string) =>
    request<void>(`/api/documents/${documentId}/reply-drafts/${draftId}`, json("PATCH", { contentDe })),
  deleteReplyDraft: (documentId: string, draftId: string) =>
    request<void>(`/api/documents/${documentId}/reply-drafts/${draftId}`, { method: "DELETE" }),

  // Chat
  listChatMessages: (documentId: string) => request<ChatMessageDto[]>(`/api/documents/${documentId}/chat`),
  clearChat: (documentId: string) => request<void>(`/api/documents/${documentId}/chat`, { method: "DELETE" }),

  // Reminders
  listReminders: () => request<RemindersDto>("/api/reminders"),
  createReminder: (input: CreateReminderInput) => request<ReminderDto>("/api/reminders", json("POST", input)),
  updateReminder: (id: string, done: boolean) => request<ReminderDto>(`/api/reminders/${id}`, json("PATCH", { done })),
  deleteReminder: (id: string) => request<void>(`/api/reminders/${id}`, { method: "DELETE" }),

  // Settings, data and usage
  getSettings: () => request<SettingsDto>("/api/settings"),
  updateSettings: (input: UpdateSettingsInput) => request<SettingsDto>("/api/settings", json("PATCH", input)),
  deleteAccount: () => request<void>("/api/account", json("DELETE", { confirm: "DELETE" })),
  getUsage: (days: UsagePeriod) => request<UsageDto>(`/api/usage?days=${days}`),

  // Plain URLs: downloads, the file preview and Server-Sent Events
  /** A plain link, so the browser downloads the file */
  exportUrl: "/api/account/export",
  fileUrl: (id: string) => `/api/documents/${id}/file`,
  eventsUrl: (id: string) => `/api/documents/${id}/events`,
  explanationUrl: (id: string, language: string) =>
    `/api/documents/${id}/explanation?language=${encodeURIComponent(language)}`,
  /** POST with a Server-Sent Events answer (EventSource only does GET), see useChat */
  chatUrl: (documentId: string) => `/api/documents/${documentId}/chat`,
};

export const queryKeys = {
  account: ["account"] as const,
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  replyDrafts: (id: string) => ["documents", id, "reply-drafts"] as const,
  translation: (id: string, language: string, analysisCreatedAt: string) =>
    ["documents", id, "translation", language, analysisCreatedAt] as const,
  chat: (id: string) => ["documents", id, "chat"] as const,
  reminders: ["reminders"] as const,
  health: ["health"] as const,
  settings: ["settings"] as const,
  usage: (days: number) => ["usage", days] as const,
};
