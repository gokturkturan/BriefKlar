import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./auth/authRoutes";
import { loadSession, requireAccount, requireUser } from "./auth/requireUser";
import { chatRouter } from "./chat/chatRoutes";
import { env } from "./config/env";
import { documentsRouter } from "./documents/documentRoutes";
import { explanationRouter } from "./explanation/explanationRoutes";
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

  // Caddy (production) and the Vite dev server forward requests from a private address
  app.set("trust proxy", "loopback, uniquelocal");
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRouter);

  app.use("/api", loadSession);
  app.use("/api/auth", authRouter);

  // Guests can upload a letter and read its analysis
  app.use("/api", requireUser);
  app.use("/api/documents/:id/explanation", requireAccount, explanationRouter);
  app.use("/api/documents/:id/translation", analysisTranslationRouter);
  app.use("/api/documents/:id/reply-drafts", requireAccount, replyDraftsRouter);
  app.use("/api/documents/:id/chat", requireAccount, chatRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/settings", settingsRouter);
  // The rest needs an account
  app.use("/api/account", requireAccount, accountRouter);
  app.use("/api/reminders", requireAccount, remindersRouter);
  app.use("/api/usage", requireAccount, usageRouter);
  if (env.NODE_ENV === "development") app.use("/api/debug", debugRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
