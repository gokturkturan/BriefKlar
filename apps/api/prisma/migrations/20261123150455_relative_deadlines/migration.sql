-- AlterTable
ALTER TABLE "Deadline" ADD COLUMN     "explanation" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isEstimate" BOOLEAN NOT NULL DEFAULT false;
