import { Router } from "express";
import { ANALYSIS_LANGUAGE, isExplanationLanguage } from "@briefklar/shared";
import { HttpError } from "../lib/httpError";
import { latestExtraction } from "../documents/extractions";
import { LLMError } from "../llm";
import { LLMValidationError } from "../llm/generateStructured";
import { getOrCreateTranslation } from "./analysisTranslations";
import { findOwnedDocument } from "../documents/ownedDocument";

/** Mounted at /api/documents/:id/translation */
export const analysisTranslationRouter = Router({ mergeParams: true });

// GET /api/documents/:id/translation?language=tr
// The analysis texts in the reader's language. Cached; translated on the first request.
analysisTranslationRouter.get("/", async (req, res) => {
  const { language } = req.query;
  if (!isExplanationLanguage(language) || language === ANALYSIS_LANGUAGE) {
    throw new HttpError(400, "Unsupported language", "INVALID_LANGUAGE");
  }

  const doc = await findOwnedDocument(req);
  const extraction = await latestExtraction(doc.id);
  if (doc.status !== "DONE" || !extraction) {
    throw new HttpError(409, "This letter has not been analyzed yet.", "NOT_ANALYZED");
  }

  try {
    res.json(await getOrCreateTranslation(extraction, language));
  } catch (err) {
    if (err instanceof LLMError) throw new HttpError(503, err.userMessage, err.code);
    if (err instanceof LLMValidationError) {
      throw new HttpError(502, "The AI returned an incomplete translation. Please try again.", "AI_INCOMPLETE");
    }
    throw err;
  }
});
