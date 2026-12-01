import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ChatMessageDto, ChatStreamEvent, ChatToolName, ErrorCode } from "@briefklar/shared";
import { api, ApiError, queryKeys } from "../api/client";

export interface ToolActivity {
  name: ChatToolName;
  status: "running" | "done" | "failed";
}

/** The answer being written: the question, the tools the model is using and the text so far */
export interface PendingTurn {
  question: string;
  tools: ToolActivity[];
  text: string;
}

export type ChatError = { code?: ErrorCode; question: string };

/** Splits a Server-Sent Events stream into the JSON payloads of its "data:" lines */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    // stream: true keeps a character that is split across two chunks intact
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      if (data) yield JSON.parse(data) as ChatStreamEvent;
    }
  }
}

/**
 * The conversation about one letter. Sending posts the question and reads the answer as a
 * stream: tool activity first, then the text. Leaving the page aborts the request, which also
 * stops the model on the server.
 */
export function useChat(documentId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.chat(documentId);
  const messages = useQuery({ queryKey: key, queryFn: () => api.listChatMessages(documentId) });
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), [documentId]);

  const send = async (question: string) => {
    if (pending) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setError(null);
    let turn: PendingTurn = { question, tools: [], text: "" };
    setPending(turn);
    const update = (next: PendingTurn) => {
      turn = next;
      setPending(next);
    };

    try {
      const res = await fetch(api.chatUrl(documentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: ErrorCode } } | null;
        throw new ApiError("Request failed", res.status, body?.error?.code);
      }

      for await (const event of readEvents(res.body)) {
        switch (event.type) {
          case "tool": {
            const others = turn.tools.filter((tool) => tool.name !== event.name || tool.status !== "running");
            update({ ...turn, tools: [...others, { name: event.name, status: event.status }] });
            break;
          }
          case "delta":
            update({ ...turn, text: turn.text + event.text });
            break;
          case "done":
            queryClient.setQueryData<ChatMessageDto[]>(key, (old) => [
              ...(old ?? []),
              event.userMessage,
              event.message,
            ]);
            // The model may have set a reminder
            if (event.message.toolCalls.some((call) => call.name === "create_reminder")) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.reminders });
            }
            setPending(null);
            return;
          case "error":
            setError({ code: event.code, question });
            setPending(null);
            return;
        }
      }
      // The stream ended without "done" or "error": the connection was lost
      setError({ question });
    } catch (err) {
      if (abort.signal.aborted) return;
      setError({ code: err instanceof ApiError ? err.code : undefined, question });
    }
    setPending(null);
  };

  const clear = async () => {
    await api.clearChat(documentId);
    queryClient.setQueryData<ChatMessageDto[]>(key, []);
    setError(null);
  };

  return { messages, pending, error, send, clear };
}
