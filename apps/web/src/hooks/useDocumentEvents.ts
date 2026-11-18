import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isTerminalStatus, type DocumentDto, type ProgressEvent } from "@briefklar/shared";
import { api, queryKeys } from "../api/client";

/**
 * Listens to the document's SSE stream while it is being processed
 * and writes the new status straight into the TanStack Query cache.
 */
export function useDocumentEvents(id: string, enabled: boolean): ProgressEvent | null {
  const queryClient = useQueryClient();
  const [lastEvent, setLastEvent] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(api.eventsUrl(id));

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ProgressEvent;
      setLastEvent(event);

      queryClient.setQueryData<DocumentDto>(queryKeys.document(id), (old) =>
        old ? { ...old, status: event.status, errorMessage: event.message ?? old.errorMessage } : old,
      );

      if (isTerminalStatus(event.status)) {
        source.close();
        void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      }
    };

    // EventSource reconnects automatically on errors; we stop instead and
    // rely on the regular query to show the latest state.
    source.onerror = () => source.close();

    return () => source.close();
  }, [id, enabled, queryClient]);

  return lastEvent;
}
