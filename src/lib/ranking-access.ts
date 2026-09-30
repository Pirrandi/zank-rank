// Ranking access resolution: role lookup + visibility policy for a single ranking (design
// D2/D5/D7). Server-only (React.cache + next/headers + Prisma): never import from middleware.ts.
//
// Identity resolution flow (design D3/D4/D7):
//   session cookie -> verifySessionIdentity (crypto only) -> legacy `admin.*` tokens resolve
//   to the OWNER of the root ranking. Role always comes from RankingMember — `Ranking.ownerId`
//   never existed as a source of truth for this and was dropped from the schema in PR10.
//
// canView/canInteract below are an interim policy: PUBLIC/PRIVATE + role only. The guild-
// membership branch (design D1) is a stub until PR7's src/lib/guild.ts lands; PR6 centralizes
// this into src/lib/ranking-policy.ts, which this module will delegate to.

import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Ranking, User } from "@prisma/client";
import { prisma } from "./prisma";
import { SESSION_COOKIE_NAME, verifySessionIdentity } from "./session";
import { ROOT_SLUG, getRankingBySlug } from "./ranking";
import { getEdition } from "./edition";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type RankingRole = "OWNER" | "ADMIN" | "VIEWER";

const ROLE_RANK: Record<RankingRole, number> = { VIEWER: 1, ADMIN: 2, OWNER: 3 };

// True when `role` meets or exceeds `min` (OWNER > ADMIN > VIEWER, design D5). A null role
// (no membership) never satisfies any minimum.
export function roleAtLeast(role: RankingRole | null, min: RankingRole): boolean {
  return role !== null && ROLE_RANK[role] >= ROLE_RANK[min];
}

export type RankingAccess = {
  ranking: Ranking;
  user: User | null;
  role: RankingRole | null;
  canView: boolean;
  canInteract: boolean;
};

// Core policy, independent of cookies/request context so it can be exercised directly against
// real DB rows (see scripts/verify-role-matrix.ts). Guild-membership override (design D1):
// a logged-in user with no RankingMember row on a PRIVATE ranking still gets access when
// they're a verified member of that ranking's linked Discord guild — this never creates or
// changes a RankingMember row, so leaving the guild only affects the guild-derived grant, not
// any explicit membership (spec "User leaves guild" scenario).
export async function resolveRankingAccess(
  ranking: Ranking,
  user: User | null,
): Promise<RankingAccess> {
  let role: RankingRole | null = null;
  if (user) {
    const membership = await prisma.rankingMember.findUnique({
      where: { userId_rankingId: { userId: user.id, rankingId: ranking.id } },
    });
    role = (membership?.role as RankingRole | undefined) ?? null;
  }

  const selfHosted = getEdition() === "self-hosted";
  const isPublic = ranking.visibility === "PUBLIC";

  let guildMember = false;

  const canView = selfHosted || isPublic || role !== null || guildMember;
  const canInteract = selfHosted || (user !== null && (isPublic || role !== null || guildMember));

  return { ranking, user, role, canView, canInteract };
}

// Resolves the session cookie to a concrete user id. Legacy `admin.*` tokens resolve to the
// OWNER of the root ranking (design D4). Returns null when there is no valid session; THROWS
// when a valid legacy-admin session exists but the root ranking is missing (migration not
// run) — fail closed.
export async function resolveCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const identity = await verifySessionIdentity(token);
  if (!identity.ok) return null;

  if (identity.kind === "user") return identity.userId;

  const root = await getRankingBySlug(ROOT_SLUG);
  if (!root) {
    throw new AuthError(
      `Root ranking "${ROOT_SLUG}" not found — run "npm run migrate-rankings" first.`,
    );
  }
  // PR10: Ranking.ownerId is gone. The root ranking's OWNER is always a RankingMember row
  // (seeded by migrate-rankings.ts step 0), so resolve it from there instead.
  const rootOwner = await prisma.rankingMember.findFirst({
    where: { rankingId: root.id, role: "OWNER" },
    orderBy: { createdAt: "asc" },
  });
  if (!rootOwner) {
    throw new AuthError(
      `Root ranking "${ROOT_SLUG}" has no OWNER membership — run "npm run migrate-rankings" first.`,
    );
  }
  return rootOwner.userId;
}

// Resolves a ranking's access for the current request's session (React.cache-memoized per
// slug so a page, its layout and its server actions share one lookup). Null only when the
// slug does not resolve to a ranking.
export const getRankingAccess = cache(
  async (slug: string): Promise<RankingAccess | null> => {
    const ranking = await getRankingBySlug(slug);
    if (!ranking) return null;

    const userId = await resolveCurrentUserId();
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    return resolveRankingAccess(ranking, user);
  },
);

// Throws AuthError unless the current session holds at least `min` role on `slug`. For server
// actions and route handlers, which should catch AuthError and map it to a 401/403/redirect.
export async function requireRankingRole(slug: string, min: RankingRole): Promise<RankingAccess> {
  const access = await getRankingAccess(slug);
  if (!access) {
    throw new AuthError(`Ranking "${slug}" not found`);
  }
  if (!roleAtLeast(access.role, min)) {
    throw new AuthError(`Requires ${min} role or higher on ranking "${slug}"`);
  }
  return access;
}

// Page-level admin guard: unknown slug -> notFound(), insufficient role -> redirect to login.
// Unlike requireRankingRole, this never throws — it is meant to be awaited directly at the top
// of an admin page/layout (design D2/D3). Every admin page and layout calls this itself; the
// layout guard alone does not stop a page or server action from rendering/running on its own.
export async function getRankingAdminContext(
  slug: string,
  min: RankingRole = "ADMIN",
): Promise<RankingAccess> {
  const access = await getRankingAccess(slug);
  if (!access) notFound();
  if (!roleAtLeast(access.role, min)) redirect("/admin/login");
  return access;
}

// Server-action guard: same check as requireRankingRole, but redirects to login instead of
// throwing (design D2/D3) — actions are invoked outside the page's own error boundary, so
// every "use server" action calls this itself instead of trusting the page/layout guard.
export async function requireRankingAdminAction(
  slug: string,
  min: RankingRole = "ADMIN",
): Promise<RankingAccess> {
  try {
    return await requireRankingRole(slug, min);
  } catch {
    redirect("/admin/login");
  }
}

// Dashboard guard (design D7): self-hosted only ever has the root ranking and never shows a
// dashboard or create-ranking UI; hosted requires an active session. Every dashboard page and
// action calls this itself (design D2), not just the layout.

// Every ranking a user has a membership row on, most recently joined last (design: dashboard
// listing).
export async function getUserRankings(
  userId: string,
): Promise<Array<{ ranking: Ranking; role: RankingRole }>> {
  const memberships = await prisma.rankingMember.findMany({
    where: { userId },
    include: { ranking: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ ranking: m.ranking, role: m.role as RankingRole }));
}
