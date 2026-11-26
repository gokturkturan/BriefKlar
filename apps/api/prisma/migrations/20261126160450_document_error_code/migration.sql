-- Lets the web app explain a failed analysis in the user's language
ALTER TABLE "Document" ADD COLUMN "errorCode" TEXT;
