-- AlterTable
ALTER TABLE "Deadline" DROP COLUMN "reminderSentAt";

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "origin" TEXT NOT NULL,
    "remindOn" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "deadlineKey" TEXT,
    "deadlineKind" TEXT,
    "dueDate" DATE,
    "firedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_userId_remindOn_idx" ON "Reminder"("userId", "remindOn");

-- CreateIndex
CREATE INDEX "Reminder_remindOn_idx" ON "Reminder"("remindOn");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_documentId_deadlineKey_key" ON "Reminder"("documentId", "deadlineKey");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

