import type { Response } from "express";

/**
 * Starts a Server-Sent Events answer. `send` writes one JSON event. `signal` aborts when the
 * browser leaves before the answer is complete, so the model can stop (and stop costing tokens).
 */
export function openSse<Event>(res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable buffering behind nginx
  });
  res.flushHeaders(); // the browser sees the stream open while the model is still thinking

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abort.abort();
  });

  return {
    send: (event: Event) => res.write(`data: ${JSON.stringify(event)}\n\n`),
    signal: abort.signal,
  };
}
