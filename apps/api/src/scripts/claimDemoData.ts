import "../config/env";
import { moveUserData } from "../auth/moveUserData";
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
  const updated = await prisma.user.update({
    where: { id: account.id },
    data: { state: account.state ?? demo.state, retentionDays: account.retentionDays ?? demo.retentionDays },
  });
  const moved = await moveUserData(demo, updated);
  console.log(
    `Moved ${moved.letters} letter(s), ${moved.reminders} reminder(s) and ${moved.llmCalls} AI call(s) ` +
      `to ${email} and deleted the demo user.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
