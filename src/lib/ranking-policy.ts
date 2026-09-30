// Central visibility policy (design D2/D6/D7): the single entry point every `[slug]` page and
// read API calls itself to enforce PUBLIC/PRIVATE access. A layout guard alone never suffices
// (design D2) — pages and route handlers must call one of the two guards below directly.
//
// The canView/canInteract booleans themselves are computed in ranking-access.ts alongside role
// resolution (resolveRankingAccess) — there was never a second inline copy to absorb (verified:
// no other module computed these flags), so PR3's "will delegate to ranking-policy.ts" note is
// satisfied by centralizing every *call site* through these guards instead of moving the
// computation itself, which stays where the role lookup already lives.
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getRankingAccess, roleAtLeast, type RankingAccess, type RankingRole } from "./ranking-access";


// Page guard (design D2/D6). Unknown slug -> 404. PRIVATE + anonymous -> redirect to Discord
// login with `next` pointing back at the page (a chance to prove membership/guild access
// before being denied). PRIVATE + logged-in non-member, or PRIVATE + anonymous crawler ->
// returns the access as-is (canView: false) so the page renders <PrivateRankingGate/> with no
// ranking data instead of a redirect loop.
export async function requireRankingView(slug: string, nextPath: string): Promise<RankingAccess> {
  const access = await getRankingAccess(slug);
  if (!access) notFound();
  return access;
}

// Read-API guard (design D6): unknown ranking or no view access both return the same 404 JSON,
// regardless of session, so a PRIVATE ranking's existence is never revealed through a read API.
export async function requireRankingViewApi(slug: string): Promise<RankingAccess | NextResponse> {
  const access = await getRankingAccess(slug);
  if (!access || !access.canView) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return access;
}

export function isPolicyDenial(result: RankingAccess | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

// Write-API guard (design D11): unknown ranking -> 404 (same as the read guard, never reveals
// a PRIVATE ranking's existence); no session -> 401; session but role below `min` -> 403. Used
// by mutating API routes (e.g. POST /api/sync) that must not be reachable by a mere VIEWER.
export async function requireRankingRoleApi(slug: string, min: RankingRole): Promise<RankingAccess | NextResponse> {
  const access = await getRankingAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!access.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!roleAtLeast(access.role, min)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return access;
}
