import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessageDto, type ChatToolCallDto } from "@briefklar/shared";
import { useChat, type AgentActivity, type ToolActivity } from "../hooks/useChat";
import { useErrorText } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";
import { PlainText } from "./PlainText";
import { replyDraftElementId } from "./replyDraftAnchor";

const toolStyles: Record<ToolActivity["status"], string> = {
  running: "bg-amber-50 text-amber-800",
  done: "bg-emerald-50 text-emerald-800",
  failed: "bg-slate-100 text-slate-500 line-through",
};

/** Shows which tools the model called, so the user can see what the answer is based on */
function ToolChips({ tools }: { tools: (ToolActivity | ChatToolCallDto)[] }) {
  const { t } = useI18n();
  if (tools.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={t.chat.toolsUsed}>
      {tools.map((tool, i) => {
        const status = "status" in tool ? tool.status : tool.ok ? "done" : "failed";
        return (
          <li key={i} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${toolStyles[status]}`}>
            {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
            {t.chat.tools[tool.name]}
          </li>
        );
      })}
    </ul>
  );
}

/** What the other agents do while the chat waits for them: what the user sees of the handoff */
function AgentSteps({ agents }: { agents: AgentActivity[] }) {
  const { t } = useI18n();
  const labels: Partial<Record<AgentActivity["agent"], string>> = t.chat.agents;
  const shown = agents.filter((activity) => labels[activity.agent]);
  if (shown.length === 0) return null;
  return (
    <ul className="mb-2 space-y-1 text-sm">
      {shown.map((activity) => (
        <li key={activity.agent} className="flex items-center gap-2 text-slate-600">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              activity.status === "running"
                ? "animate-pulse bg-amber-500"
                : activity.status === "done"
                  ? "bg-emerald-500"
                  : "bg-slate-300"
            }`}
          />
          <span className={activity.status === "failed" ? "line-through" : undefined}>{labels[activity.agent]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Under an answer that delivered a reply draft: a link down to it in the reply section */
function DraftLink({ draft }: { draft: NonNullable<ChatMessageDto["replyDraft"]> }) {
  const { t } = useI18n();
  const open = () => {
    const element = document.getElementById(replyDraftElementId(draft.id));
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    element?.querySelector("textarea")?.focus({ preventScroll: true });
  };
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-emerald-50 px-3 py-2 text-sm">
      <span className="text-emerald-900">{t.chat.draftSaved(t.replies.types[draft.type])}</span>
      <a
        href={`#${replyDraftElementId(draft.id)}`}
        onClick={(e) => {
          e.preventDefault();
          open();
        }}
        className="font-medium text-emerald-700 hover:underline"
      >
        {t.chat.openDraft}
      </a>
    </p>
  );
}

function AssistantMessage({ message }: { message: ChatMessageDto }) {
  const { t } = useI18n();
  const setReminder = message.toolCalls.some((call) => call.name === "create_reminder" && call.ok);
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <ToolChips tools={message.toolCalls} />
      {/* Usually in the reader's language, but an answer from before a language change may not be */}
      <div dir="auto">
        <PlainText text={message.content} />
      </div>
      {message.replyDraft && <DraftLink draft={message.replyDraft} />}
      {setReminder && (
        <p className="mt-2 text-sm">
          <Link to="/reminders" className="font-medium text-emerald-700 hover:underline">
            {t.chat.seeReminders}
          </Link>
        </p>
      )}
      {message.sources.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.chat.sources}</p>
          <ul className="mt-1 space-y-0.5">
            {message.sources.map((source) => (
              <li key={source.url}>
                {/* Source titles are English, the laws themselves German */}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  lang="en"
                  dir="ltr"
                  className="text-emerald-700 hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {message.model && <p className="mt-2 text-xs text-slate-400">{t.chat.answeredBy(message.model)}</p>}
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <p className="ms-auto max-w-[85%] whitespace-pre-line rounded-lg bg-emerald-600 px-3 py-2 text-white" dir="auto">
      {text}
    </p>
  );
}

export function ChatPanel({ documentId }: { documentId: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const { messages, pending, error, send, clear } = useChat(documentId);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const history = messages.data ?? [];
  // Follow the answer while it is written (not on page load, which would jump to the chat)
  const following = Boolean(pending);
  useEffect(() => {
    if (following) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [following, pending?.text, pending?.tools.length, pending?.agents.length]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setDraft("");
    void send(text);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-600">{t.chat.intro}</p>

      {messages.error && <p className="mt-3 text-sm text-red-600">{errorText(messages.error)}</p>}

      <div className="mt-3 space-y-3" aria-live="polite">
        {history.map((message) =>
          message.role === "user" ? (
            <UserMessage key={message.id} text={message.content} />
          ) : (
            <AssistantMessage key={message.id} message={message} />
          ),
        )}

        {pending && (
          <>
            <UserMessage text={pending.question} />
            <div className="rounded-lg bg-slate-50 p-3">
              <ToolChips tools={pending.tools} />
              <AgentSteps agents={pending.agents} />
              {pending.text ? (
                <div dir="auto">
                  <PlainText text={pending.text} />
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  {t.chat.thinking}
                </p>
              )}
            </div>
          </>
        )}

        {error && (
          <p className="flex flex-wrap items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.code ? errorText(null, error.code) : t.errors.connectionLost}
            <button type="button" onClick={() => ask(error.question)} className="font-medium underline">
              {t.common.tryAgain}
            </button>
          </p>
        )}
        <div ref={endRef} />
      </div>

      {history.length === 0 && !pending && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {t.chat.suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => ask(suggestion)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800 hover:bg-emerald-100"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter adds a line
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              ask(draft);
            }
          }}
          rows={2}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          placeholder={t.chat.placeholder}
          aria-label={t.chat.placeholder}
          dir="auto"
          className="min-w-0 flex-1 resize-y rounded-md border border-slate-300 p-2 text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim() || Boolean(pending)}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {t.chat.send}
        </button>
      </form>

      {history.length > 0 && !pending && (
        <p className="mt-2 text-end text-xs">
          {confirmClear ? (
            <span className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void clear().then(() => setConfirmClear(false))}
                className="font-medium text-red-600 hover:underline"
              >
                {t.chat.clearConfirm}
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className="text-slate-500 hover:underline">
                {t.common.cancel}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="text-slate-500 hover:underline">
              {t.chat.clear}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
