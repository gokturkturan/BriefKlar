import "../config/env";
import { syncKnowledgeBase } from "../knowledge/knowledgeBase";
import { prisma } from "../lib/prisma";

/**
 * Embeds the curated knowledge base (src/knowledge/entries.ts) into PostgreSQL / pgvector.
 * Safe to run again: only new or changed entries are embedded.
 *   npm run knowledge:seed -w @briefklar/api
 */
async function main() {
  const { embedded, unchanged, removed } = await syncKnowledgeBase();
  console.log(`Knowledge base: ${embedded} embedded, ${unchanged} unchanged, ${removed} removed.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
