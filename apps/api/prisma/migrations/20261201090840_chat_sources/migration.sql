-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "model" TEXT,
ADD COLUMN     "sources" JSONB NOT NULL DEFAULT '[]';

