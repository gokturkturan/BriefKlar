-- AlterTable
ALTER TABLE "LlmCall" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "LlmCall_userId_createdAt_idx" ON "LlmCall"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LlmCall" ADD CONSTRAINT "LlmCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Calls logged before accounts belong to the owner of their letter
UPDATE "LlmCall" AS c SET "userId" = d."userId" FROM "Document" AS d WHERE c."documentId" = d."id";
