import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { EMBEDDING_DIMENSIONS, llm, type LLMProvider } from "../llm";
import { loggedCall } from "../llm/logCall";
import { KNOWLEDGE_ENTRIES, type KnowledgeSeed } from "./entries";

/** Version of the embedded text format (title + content); changing it re-embeds every entry */
export const KNOWLEDGE_EMBEDDING_VERSION = "knowledge-v1";

/** Texts per embedding request; small batches keep a failed request cheap to repeat */
const EMBED_BATCH_SIZE = 20;

export interface KnowledgeHit {
  slug: string;
  title: string;
  content: string;
  sourceUrl: string;
  /** Cosine similarity between the question and the entry, 1 = same meaning */
  similarity: number;
}

/** The text that is embedded for an entry: the title carries most of the meaning */
export function embeddingText(entry: Pick<KnowledgeSeed, "title" | "content">): string {
  return `${entry.title}\n\n${entry.content}`;
}

/** Changes whenever the embedded text, the source or the embedding model changes */
export function contentHash(entry: KnowledgeSeed, embeddingModel: string): string {
  return createHash("sha256")
    .update([KNOWLEDGE_EMBEDDING_VERSION, embeddingModel, entry.title, entry.content, entry.sourceUrl].join("\n"))
    .digest("hex");
}

/** pgvector's text format, e.g. "[0.1,-0.2,0.3]". Checked, because it is sent as a SQL value. */
export function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
  }
  if (!vector.every(Number.isFinite)) throw new Error("Embedding contains a value that is not a number");
  return `[${vector.join(",")}]`;
}

export interface SyncResult {
  embedded: number;
  unchanged: number;
  removed: number;
}

/**
 * Brings the knowledge base table in line with entries.ts: new and changed entries are
 * embedded (in batches), unchanged ones are skipped, removed ones are deleted.
 */
export async function syncKnowledgeBase(
  entries: KnowledgeSeed[] = KNOWLEDGE_ENTRIES,
  provider: LLMProvider = llm,
): Promise<SyncResult> {
  const model = provider.embeddingModel;
  const existing = new Map(
    (await prisma.knowledgeEntry.findMany({ select: { slug: true, contentHash: true } })).map((row) => [
      row.slug,
      row.contentHash,
    ]),
  );
  const changed = entries.filter((entry) => existing.get(entry.slug) !== contentHash(entry, model));

  for (let i = 0; i < changed.length; i += EMBED_BATCH_SIZE) {
    const batch = changed.slice(i, i + EMBED_BATCH_SIZE);
    const context = { provider, purpose: "embed-knowledge", promptVersion: KNOWLEDGE_EMBEDDING_VERSION };
    const result = await loggedCall(context, () =>
      provider.embed({ texts: batch.map(embeddingText), kind: "document" }),
    );

    await prisma.$transaction(async (tx) => {
      for (const [j, entry] of batch.entries()) {
        const data = {
          title: entry.title,
          content: entry.content,
          sourceUrl: entry.sourceUrl,
          language: "en",
          contentHash: contentHash(entry, model),
          embeddingModel: model,
        };
        await tx.knowledgeEntry.upsert({ where: { slug: entry.slug }, create: { slug: entry.slug, ...data }, update: data });
        const vector = toVectorLiteral(result.vectors[j]!);
        await tx.$executeRaw`UPDATE "KnowledgeEntry" SET "embedding" = ${vector}::vector WHERE "slug" = ${entry.slug}`;
      }
    });
  }

  const slugs = entries.map((entry) => entry.slug);
  const removed = await prisma.knowledgeEntry.deleteMany({ where: { slug: { notIn: slugs } } });
  return { embedded: changed.length, unchanged: entries.length - changed.length, removed: removed.count };
}

export interface SearchOptions {
  /** Most entries to return */
  limit?: number;
  /** Entries less similar than this are left out, so an unrelated question finds nothing */
  minSimilarity?: number;
  documentId?: string;
  signal?: AbortSignal;
  provider?: LLMProvider;
}

/**
 * Semantic search: the question is embedded and compared with every entry by cosine distance
 * (pgvector's <=> operator). Only entries embedded with the current model are compared.
 */
export async function searchKnowledge(query: string, options: SearchOptions = {}): Promise<KnowledgeHit[]> {
  const { limit = 4, minSimilarity = 0.6, documentId, signal, provider = llm } = options;
  const context = { provider, purpose: "embed-query", promptVersion: KNOWLEDGE_EMBEDDING_VERSION, documentId };

  const result = await loggedCall(context, () => provider.embed({ texts: [query], kind: "query", signal }), {
    signal,
  });

  const vector = toVectorLiteral(result.vectors[0]!);
  const rows = await prisma.$queryRaw<KnowledgeHit[]>(Prisma.sql`
    SELECT "slug", "title", "content", "sourceUrl",
           (1 - ("embedding" <=> ${vector}::vector))::float8 AS "similarity"
    FROM "KnowledgeEntry"
    WHERE "embedding" IS NOT NULL AND "embeddingModel" = ${result.model}
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `);
  return rows.filter((row) => row.similarity >= minSimilarity);
}
