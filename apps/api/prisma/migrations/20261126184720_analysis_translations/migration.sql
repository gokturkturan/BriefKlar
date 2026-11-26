-- CreateTable
CREATE TABLE "AnalysisTranslation" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisTranslation_extractionId_language_key" ON "AnalysisTranslation"("extractionId", "language");

-- AddForeignKey
ALTER TABLE "AnalysisTranslation" ADD CONSTRAINT "AnalysisTranslation_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "Extraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
