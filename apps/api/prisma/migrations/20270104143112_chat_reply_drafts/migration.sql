-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "replyDraftId" TEXT;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyDraftId_fkey" FOREIGN KEY ("replyDraftId") REFERENCES "ReplyDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
