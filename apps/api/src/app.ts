import cors from "cors";
import express from "express";
import helmet from "helmet";
import { chatRouter } from "./chat/chatRoutes";
import { env } from "./config/env";
import { documentsRouter } from "./documents/documentRoutes";
import { explanationRouter } from "./explanation/explanationRoutes";
import { demoUser } from "./middleware/demoUser";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { accountRouter } from "./privacy/accountRoutes";
import { remindersRouter } from "./reminders/reminderRoutes";
import { replyDraftsRouter } from "./replies/replyDraftRoutes";
import { settingsRouter } from "./settings/settingsRoutes";
import { debugRouter } from "./system/debugRoutes";
import { healthRouter } from "./system/healthRoutes";
import { analysisTranslationRouter } from "./translation/translationRoutes";
import { usageRouter } from "./usage/usageRoutes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRouter);

  app.use("/api", demoUser);
  app.use("/api/documents/:id/explanation", explanationRouter);
  app.use("/api/documents/:id/translation", analysisTranslationRouter);
  app.use("/api/documents/:id/reply-drafts", replyDraftsRouter);
  app.use("/api/documents/:id/chat", chatRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/reminders", remindersRouter);
  app.use("/api/usage", usageRouter);
  if (env.NODE_ENV === "development") app.use("/api/debug", debugRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
