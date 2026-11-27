import { useEffect, useState } from "react";
import type { ErrorCode, ExplanationDto, ExplanationLanguage, ExplanationStreamEvent } from "@briefklar/shared";
import { api } from "../api/client";

export type ExplanationState =
  | { status: "idle" }
  | { status: "streaming"; text: string }
  | { status: "done"; explanation: ExplanationDto }
  | { status: "error"; message: string; code?: ErrorCode; text: string };

/**
 * Opens the explanation stream for one language and collects the chunks.
 * A stored explanation arrives as a single "done" event.
 * Changing `attempt` opens the stream again (for "Try again").
 */
export function useExplanationStream(
  documentId: string,
  language: ExplanationLanguage,
  enabled: boolean,
  attempt = 0,
): ExplanationState {
  const [state, setState] = useState<ExplanationState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    let text = "";
    setState({ status: "streaming", text });
    const source = new EventSource(api.explanationUrl(documentId, language));

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ExplanationStreamEvent;
      if (event.type === "delta") {
        text += event.text;
        setState({ status: "streaming", text });
        return;
      }
      source.close();
      setState(
        event.type === "done"
          ? { status: "done", explanation: event.explanation }
          : { status: "error", message: event.message, code: event.code, text },
      );
    };

    // The server closes the stream after "done" or "error", so an error here means a lost
    // connection. EventSource would reconnect and start a new (paid) generation: stop instead.
    source.onerror = () => {
      source.close();
      setState((current) =>
        current.status === "streaming"
          ? { status: "error", message: "The connection was lost. Please try again.", text }
          : current,
      );
    };

    return () => source.close();
  }, [documentId, language, enabled, attempt]);

  return state;
}
