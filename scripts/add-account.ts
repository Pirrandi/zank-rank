import { prisma } from "../src/lib/prisma";
import { addTrackedAccount } from "../src/lib/accounts";
import { ROOT_SLUG, getRankingBySlug } from "../src/lib/ranking";

async function main() {
  const [gameName, tagLine] = process.argv.slice(2);
  if (!gameName || !tagLine) {
    console.error("Usage: npx tsx scripts/add-account.ts <gameName> <tagLine>");
    process.exit(1);
  }

  // The CLI operates on the root workspace (design D1); the admin panel passes the session's
  // own rankingId instead.
  const root = await getRankingBySlug(ROOT_SLUG);
  if (!root) {
    console.error(`Root workspace "${ROOT_SLUG}" not found — run "npm run migrate-workspaces" first.`);
    process.exit(1);
  }

  const saved = await addTrackedAccount(gameName, tagLine, "la2", root.id);

  console.log(`Tracked account: ${saved.gameName}#${saved.tagLine} (${saved.id})`);
}

main()
  .catch((err) => {
    // Límite de la versión web: mensaje claro en vez del stack trace.
    let message: unknown = err;
    console.error(message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
