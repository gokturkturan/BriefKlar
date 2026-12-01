import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { demoUser } from "./middleware/demoUser";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { analysisTranslationRouter } from "./routes/analysisTranslation";
import { chatRouter } from "./routes/chat";
import { debugRouter } from "./routes/debug";
import { documentsRouter } from "./routes/documents";
import { explanationRouter } from "./routes/explanation";
import { remindersRouter } from "./routes/reminders";
import { replyDraftsRouter } from "./routes/replyDrafts";
import { settingsRouter } from "./routes/settings";
import { healthRouter } from "./routes/health";

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
  app.use("/api/reminders", remindersRouter);
  if (env.NODE_ENV === "development") app.use("/api/debug", debugRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
