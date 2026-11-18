import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { demoUser } from "./middleware/demoUser";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { documentsRouter } from "./routes/documents";
import { healthRouter } from "./routes/health";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRouter);

  app.use("/api", demoUser);
  app.use("/api/documents", documentsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
