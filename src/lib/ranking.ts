// Ranking resolution + slug helpers.
//
// Rankings are the tenant root of the app. Each ranking lives at zank.lol/<slug>; the
// bootstrap root ranking (seeded by `npm run migrate-rankings`) uses the reserved slug
// ROOT_SLUG and is the target of the legacy password login and legacy `admin.*` sessions.
//
// Renamed from workspace.ts (design "Rename Workspace to Ranking in code only"). The Prisma
// model is now named `Ranking` (mapped to the pre-existing "Workspace" table via `@@map`,
// see prisma/schema.prisma) so `prisma.ranking.*` is the real Prisma Client model delegate.

import { prisma } from "./prisma";
import type { Ranking } from "@prisma/client";

export type { Ranking };

// Bootstrap root ranking slug, seeded by scripts/migrate-rankings.ts (design D1).
export const ROOT_SLUG = "zank";

// Slugs that collide with static routes or reserved names must never be handed out to a
// ranking (design D4/D5).
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "en-vivo",
  "versus",
  "muros",
  "analisis",
  "bot",
  "players",
  "admin",
  "api",
  "login",
  "logout",
  "auth",
  "dashboard",
  "w",
  "zank",
]);

// Slug shape: 2-32 chars of lowercase letters, digits and dashes.
export const SLUG_PATTERN = /^[a-z0-9-]{2,32}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

// Deterministic slug from a Discord username: lowercase, non-alphanumeric runs become dashes.
// Returns "" when nothing usable remains — callers decide the fallback.
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Finds the first free slug derived from `base`, appending "-2", "-3", ... on collision.
// `rankingId` excludes the current ranking from collision checks (renames keep their slug).
export async function ensureUniqueSlug(base: string, rankingId?: string): Promise<string> {
  const cleaned = slugify(base);
  const candidateBase = (cleaned.length >= 2 ? cleaned : "user")
    .slice(0, 32)
    .replace(/-+$/, "");

  if (await isSlugFree(candidateBase, rankingId)) return candidateBase;
  for (let suffix = 2; suffix <= 1000; suffix++) {
    const candidate = `${candidateBase}-${suffix}`;
    if (!isValidSlug(candidate)) break;
    if (await isSlugFree(candidate, rankingId)) return candidate;
  }
  throw new Error(`Could not find a free slug for "${base}"`);
}

async function isSlugFree(slug: string, rankingId?: string): Promise<boolean> {
  // Reserved slugs are never re-issued, even to the ranking currently holding one: the
  // root ranking is seeded directly by the migration and static routes must not collide.
  if (RESERVED_SLUGS.has(slug)) return false;
  const existing = await prisma.ranking.findUnique({ where: { slug } });
  if (!existing) return true;
  return existing.id === rankingId;
}

export async function getRankingBySlug(slug: string): Promise<Ranking | null> {
  return prisma.ranking.findUnique({ where: { slug } });
}

// Same kind of manual cascade as deleteTrackedAccountCascade (src/lib/accounts.ts): these
// relations default to Restrict, not Cascade, so children must be cleared before the Ranking
// row itself can go. RankingMember is the one exception — it has onDelete: Cascade to Ranking
// in the schema, so it cleans itself up when the delete below runs and is never touched here.
// Match is never touched either: it holds Riot data shared across rankings and has no
// rankingId of its own (isolation comes from MatchParticipation.rankingId).
export async function deleteRankingCascade(rankingId: string): Promise<void> {
  await prisma.$transaction([
    prisma.prediction.deleteMany({ where: { rankingId } }),
    prisma.predictionRound.deleteMany({ where: { rankingId } }),
    prisma.rankSnapshot.deleteMany({ where: { rankingId } }),
    prisma.matchParticipation.deleteMany({ where: { rankingId } }),
    prisma.playerAnalysis.deleteMany({ where: { rankingId } }),
    prisma.reaction.deleteMany({ where: { rankingId } }),
    prisma.bettor.deleteMany({ where: { rankingId } }),
    prisma.setting.deleteMany({ where: { rankingId } }),
    prisma.trackedAccount.deleteMany({ where: { rankingId } }),
    prisma.ranking.delete({ where: { id: rankingId } }),
  ]);
}
