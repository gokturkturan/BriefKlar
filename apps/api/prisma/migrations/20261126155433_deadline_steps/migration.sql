-- Calculation steps are stored as data now, so the web app can show them in any language.
-- Existing rows get their steps back with `npm run deadlines:recompute`.
ALTER TABLE "Deadline" DROP COLUMN "explanation";
ALTER TABLE "Deadline" ADD COLUMN "steps" JSONB NOT NULL DEFAULT '[]';
