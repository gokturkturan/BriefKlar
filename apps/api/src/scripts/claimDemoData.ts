import "../config/env";
import { recomputeDeadlines } from "../deadlines/recomputeDeadlines";
import { prisma } from "../lib/prisma";

/**
 * Before there were accounts, every letter belonged to one demo user, who cannot sign in. This
 * moves the demo user's letters, reminders and logged AI calls to an account and deletes the
 * demo user. Sign up with the address first, then:
 * npm run demo:claim -- you@example.com
 */
const DEMO_EMAIL = "demo@briefklar.local";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run demo:claim -- you@example.com");

  const [demo, account] = await Promise.all([
    prisma.user.findUnique({ where: { email: DEMO_EMAIL } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (!demo) {
    console.log("There is no demo user, so there is nothing to move.");
    return;
  }
  if (!account?.passwordHash) throw new Error(`There is no account for ${email}. Sign up in the web app first.`);

  // Settings the account has not chosen yet are taken from the demo user
  const state = account.state ?? demo.state;
  const move = { where: { userId: demo.id }, data: { userId: account.id } };
  const [letters, reminders, llmCalls] = await prisma.$transaction([
    prisma.document.updateMany(move),
    prisma.reminder.updateMany(move),
    prisma.llmCall.updateMany(move),
    prisma.user.update({
      where: { id: account.id },
      data: { state, retentionDays: account.retentionDays ?? demo.retentionDays },
    }),
    prisma.user.delete({ where: { id: demo.id } }),
  ]);
  console.log(
    `Moved ${letters.count} letter(s), ${reminders.count} reminder(s) and ${llmCalls.count} AI call(s) ` +
      `to ${email} and deleted the demo user.`,
  );

  // Regional holidays of another federal state can move due dates
  if (state !== demo.state) {
    const docs = await prisma.document.findMany({
      where: { userId: account.id, status: "DONE" },
      select: { id: true },
    });
    for (const doc of docs) await recomputeDeadlines(doc.id);
    console.log(`Recalculated the deadlines of ${docs.length} letter(s) for the account's federal state.`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
