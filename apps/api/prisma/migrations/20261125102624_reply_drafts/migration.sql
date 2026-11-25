-- AlterTable
ALTER TABLE "ReplyDraft" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "model" TEXT,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "promptVersion" TEXT;

-- CreateIndex
CREATE INDEX "ReplyDraft_documentId_createdAt_idx" ON "ReplyDraft"("documentId", "createdAt");
