import { env } from "./config/env";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { ensureDemoUser } from "./middleware/demoUser";
import { documentQueue } from "./queue/documentQueue";
import { startDocumentEvents, stopDocumentEvents } from "./queue/documentEvents";
import { initStorage } from "./storage";

async function main() {
  await initStorage();
  await ensureDemoUser();
  startDocumentEvents();

  const server = createApp().listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close();
    await Promise.allSettled([stopDocumentEvents(), documentQueue.close(), prisma.$disconnect()]);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
