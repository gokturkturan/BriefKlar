import { EventEmitter } from "node:events";
import { QueueEvents } from "bullmq";
import type { ProgressEvent } from "@briefklar/shared";
import { createRedisConnection } from "../lib/redis";
import { DOCUMENT_QUEUE } from "./queueConstants";

/**
 * Bridges BullMQ progress events (published by the worker process via Redis)
 * to in-process listeners, i.e. open SSE connections.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

let queueEvents: QueueEvents | null = null;

export function isProgressEvent(value: unknown): value is ProgressEvent {
  return typeof value === "object" && value !== null && "status" in value;
}

export function startDocumentEvents(): void {
  if (queueEvents) return;
  queueEvents = new QueueEvents(DOCUMENT_QUEUE, { connection: createRedisConnection() });
  queueEvents.on("progress", ({ jobId, data }) => {
    if (isProgressEvent(data)) emitter.emit(jobId, data);
  });
}

export async function stopDocumentEvents(): Promise<void> {
  await queueEvents?.close();
  queueEvents = null;
}

export function subscribeToDocument(
  documentId: string,
  listener: (event: ProgressEvent) => void,
): () => void {
  emitter.on(documentId, listener);
  return () => emitter.off(documentId, listener);
}
