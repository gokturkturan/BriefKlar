-- The knowledge base was empty until now, so the new required columns need no defaults.
-- No vector index: the curated base holds a few dozen entries, where an exact scan is fast
-- and never misses a match. An HNSW index (vector_cosine_ops) is the next step if it grows.

-- AlterTable
ALTER TABLE "KnowledgeEntry" ADD COLUMN     "contentHash" TEXT NOT NULL,
ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_slug_key" ON "KnowledgeEntry"("slug");
