// Ranking migration script (design D9/D13, "Migration" section).
//
// Idempotent: safe to run multiple times. Backs up the DB file first (unless
// MIGRATE_SKIP_BACKUP=1, see main()).
//
// Steps (added incrementally as the workspace→ranking split lands):
//   0. (PR2a) Seed the root ranking + re-point orphaned rows — merged from
//      scripts/migrate-workspaces.ts. Also creates the root's own OWNER RankingMember row.
//   1. (PR1, RETIRED in PR10) Used to upsert RankingMember(ownerId, OWNER) for every ranking
//      by reading `Ranking.ownerId`. That column is dropped in PR10 (design D9/D10) — every
//      ranking has gotten its OWNER RankingMember at creation time ever since (root bootstrap
//      in step 0 below, `createRankingAction`'s transaction for user-created rankings), so this
//      backfill is retired rather than ported: there is nothing left to read it from.
//   2. (PR8) Assert no duplicate (rankingId, puuid) / (rankingId, targetKey, userId, label).
//   3. (PR10) Record every table's row count in a sidecar JSON before the push and compare
//      after it. The pre-mutation file backup above is the rollback copy.

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const ROOT_SLUG = "zank";
const ROOT_OWNER_DISCORD_ID = "root-owner";

// All tenant models that carry `rankingId`. Order matters only for the summary output.
// Merged from scripts/migrate-workspaces.ts (design D13). "match" is NOT here — Match dropped
// its `rankingId` column in PR10 (design D9: it only ever held shared Riot facts).
const TENANT_MODELS = [
  "trackedAccount",
  "rankSnapshot",
  "matchParticipation",
  "playerAnalysis",
  "predictionRound",
  "prediction",
  "bettor",
  "reaction",
  "setting",
] as const;

interface TenantDelegate {
  updateMany(args: {
    where: { rankingId: string };
    data: { rankingId: string };
  }): Promise<{ count: number }>;
  count(args: { where: { rankingId: string } }): Promise<number>;
}

function resolveDbFile(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see prisma/schema.prisma datasource)");
  // Prisma resolves "file:" URLs relative to the schema directory (prisma/).
  const dbPath = url.replace(/^file:/, "").replace(/^sqlite:\/\//, "");
  return path.resolve(__dirname, "../prisma", dbPath);
}

// Step 0: seed the bootstrap owner + root ranking on first run only, then re-point any
// tenant row with an empty rankingId to the root. Runs on EVERY invocation (not only the
// first): rows written after the initial migration — e.g. while a temporary
// `@default("")` was still active — are re-pointed on the next run, keeping this idempotent.
// Merged from scripts/migrate-workspaces.ts (design D13); that file is now deleted and
// `npm run migrate-workspaces` stays as an alias to this script.
async function stepBootstrapAndOrphanHeal() {
  const rankingCount = await prisma.ranking.count();
  if (rankingCount === 0) {
    const owner = await prisma.user.create({
      data: { discordId: ROOT_OWNER_DISCORD_ID, username: ROOT_OWNER_DISCORD_ID },
    });
    const root = await prisma.ranking.create({
      data: {
        slug: ROOT_SLUG,
        name: process.env.WORKSPACE_ROOT_NAME ?? ROOT_SLUG,
      },
    });
    // PR10: Ranking.ownerId is gone, so the root's OWNER is expressed directly as a
    // RankingMember row here instead of a column later backfilled by (now-retired) step 1.
    await prisma.rankingMember.create({
      data: { userId: owner.id, rankingId: root.id, role: "OWNER" },
    });
    console.log(`Seeded root ranking "${root.slug}" (${root.id}) owned by ${owner.id}`);
  }

  const root = await prisma.ranking.findUnique({ where: { slug: ROOT_SLUG } });
  if (!root) {
    throw new Error(`Root ranking "${ROOT_SLUG}" not found — this should not happen after seeding.`);
  }

  const moved: Record<string, number> = {};
  for (const model of TENANT_MODELS) {
    const delegate = (prisma as unknown as Record<string, TenantDelegate>)[model];
    const { count } = await delegate.updateMany({
      where: { rankingId: "" },
      data: { rankingId: root.id },
    });
    moved[model] = count;
  }

  let orphaned = 0;
  for (const model of TENANT_MODELS) {
    const delegate = (prisma as unknown as Record<string, TenantDelegate>)[model];
    orphaned += await delegate.count({ where: { rankingId: "" } });
  }
  if (orphaned > 0) {
    throw new Error(`Verification failed: ${orphaned} tenant rows still have empty rankingId`);
  }

  const summary = TENANT_MODELS.map((m) => `${m}=${moved[m]}`).join(", ");
  console.log(`Step 0 (bootstrap + orphan heal): no tenant rows left with empty rankingId.`);
  console.log(`Step 0 summary: ${summary}`);
}

// Step 1 (RETIRED in PR10): used to read `Ranking.ownerId` here to backfill an OWNER
// RankingMember for every pre-existing ranking. The column is gone; see the header comment.

// Step 2: pre-check before the D9 unique-key push (TrackedAccount -> (rankingId, puuid),
// Reaction -> (rankingId, targetKey, userId, label)). The old keys (puuid alone;
// targetKey+userId+label alone) are strictly stricter than the new composite ones, so no
// duplicate can exist under the new key that didn't already exist under the old one — this
// is a safety assertion, not a repair step. Also records before/after row counts so a
// `db push` run around this step can be checked for silent data loss.
async function stepAssertNoDuplicateKeys() {
  const accountsBefore = await prisma.trackedAccount.count();
  const reactionsBefore = await prisma.reaction.count();

  const accountDupes = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM (
       SELECT "workspaceId", "puuid" FROM "TrackedAccount"
       GROUP BY "workspaceId", "puuid" HAVING COUNT(*) > 1
     )`,
  );
  const reactionDupes = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM (
       SELECT "workspaceId", "targetKey", "userId", "label" FROM "Reaction"
       GROUP BY "workspaceId", "targetKey", "userId", "label" HAVING COUNT(*) > 1
     )`,
  );

  if (accountDupes[0].cnt > 0 || reactionDupes[0].cnt > 0) {
    throw new Error(
      `Step 2 pre-check failed: ${accountDupes[0].cnt} duplicate (rankingId, puuid) TrackedAccount ` +
        `row(s), ${reactionDupes[0].cnt} duplicate (rankingId, targetKey, userId, label) Reaction row(s).`,
    );
  }

  console.log(
    `Step 2 (D9 unique-key pre-check): no duplicates found. ` +
      `Row counts before push — TrackedAccount=${accountsBefore}, Reaction=${reactionsBefore}.`,
  );
}

// Same counts, run again after `prisma db push` to confirm the index swap moved no rows.
async function stepVerifyRowCountsUnchanged() {
  const accountsAfter = await prisma.trackedAccount.count();
  const reactionsAfter = await prisma.reaction.count();
  console.log(
    `Step 2 verify (post-push row counts) — TrackedAccount=${accountsAfter}, Reaction=${reactionsAfter}.`,
  );
}

// Step 3: row-count snapshot around the D9 + PR10 `prisma db push`. The push rebuilds Bettor
// (new composite primary key), Match (dropped `workspaceId`) and Workspace (dropped `ownerId`),
// and SQLite does that by copying rows into a new table. Counts are written to a sidecar JSON
// next to the database, not to `*_legacy` tables: `db push --accept-data-loss` drops any table
// that is not in the schema, so a snapshot table would be gone before the verify step.
function countsFile(dbFile: string): string {
  return `${dbFile}.pre-push-counts.json`;
}

async function countAllTables(): Promise<Record<string, number>> {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'`,
  );
  const counts: Record<string, number> = {};
  for (const { name } of tables) {
    const [{ cnt }] = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(*) as cnt FROM "${name}"`);
    counts[name] = Number(cnt);
  }
  return counts;
}

async function stepSnapshotCounts(dbFile: string) {
  const counts = await countAllTables();
  writeFileSync(countsFile(dbFile), JSON.stringify(counts, null, 2));
  console.log(`Step 3 (pre-push counts): ${JSON.stringify(counts)} -> ${countsFile(dbFile)}`);
}

// Throws on any mismatch or missing table: restore the pre-push backup and stop, never proceed.
async function stepVerifyCounts(dbFile: string) {
  const before: Record<string, number> = JSON.parse(readFileSync(countsFile(dbFile), "utf8"));
  const after = await countAllTables();
  const diffs = Object.entries(before)
    .filter(([table, cnt]) => after[table] !== cnt)
    .map(([table, cnt]) => `${table} ${cnt} -> ${after[table] ?? "missing"}`);
  if (diffs.length > 0) {
    throw new Error(`Step 3 verify FAILED: ${diffs.join(", ")}`);
  }
  console.log(`Step 3 verify (post-push counts): unchanged for ${Object.keys(before).length} table(s).`);
}

async function main() {
  // Backup before any mutation. MIGRATE_SKIP_BACKUP=1 lo desactiva: lo usa el entrypoint de
  // Docker, que ya deja su propio backup rotativo antes de `prisma db push` y corre este script
  // en cada arranque (sin el flag se llenaría el volumen de copias).
  const dbFile = resolveDbFile();
  if (process.env.MIGRATE_SKIP_BACKUP === "1") {
    console.log("Backup: skipped (MIGRATE_SKIP_BACKUP=1)");
  } else {
    const backupFile = `${dbFile}.backup-${Math.floor(Date.now() / 1000)}`;
    copyFileSync(dbFile, backupFile);
    console.log(`Backup: ${backupFile}`);
  }

  await stepBootstrapAndOrphanHeal();

  // Flags are independent and can be combined (e.g. running the D9 and PR10 pushes together
  // needs both a pre-push and a post-push flag in the same invocation is NOT supported since
  // they run around one external `prisma db push` — call this script once before with the
  // "before" flags, run the push, then call it again with the "after" flags).
  const flags = new Set(process.argv.slice(2));
  if (flags.has("--verify-unique-keys")) await stepAssertNoDuplicateKeys();
  if (flags.has("--verify-row-counts")) await stepVerifyRowCountsUnchanged();
  if (flags.has("--snapshot-counts")) await stepSnapshotCounts(dbFile);
  if (flags.has("--verify-counts")) await stepVerifyCounts(dbFile);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
