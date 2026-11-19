/*
  Warnings:

  - You are about to drop the `LLMCall` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LLMCall" DROP CONSTRAINT "LLMCall_documentId_fkey";

-- DropTable
DROP TABLE "LLMCall";

-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmCall_createdAt_idx" ON "LlmCall"("createdAt");

-- AddForeignKey
ALTER TABLE "LlmCall" ADD CONSTRAINT "LlmCall_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
