import { spawn } from "child_process";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLpScore } from "@/lib/rank-order";
import { requireRankingViewApi, requireRankingRoleApi, isPolicyDenial } from "@/lib/ranking-policy";

// Per-ranking in-flight set (design D11/PR9): a sync run for ranking A never blocks or is
// reported by ranking B's status check, replacing the old single global `syncing` boolean.
const syncingRankings = new Set<string>();

// Ranking-scoped status snapshot: ?ranking=<slug> resolves the tenant and canView gates it
// (design D6) so a PRIVATE ranking's sync snapshot can't be read anonymously.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("ranking") ?? "";
  const result = await requireRankingViewApi(slug);
  if (isPolicyDenial(result)) return result;
  const workspace = result.ranking;

  const mostRecent = await prisma.rankSnapshot.aggregate({
    where: { rankingId: workspace.id },
    _max: { capturedAt: true },
  });

  const accounts = await prisma.trackedAccount.findMany({
    where: { rankingId: workspace.id },
    select: {
      id: true,
      gameName: true,
      tagLine: true,
      snapshots: {
        where: { queueType: "RANKED_SOLO_5x5" },
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
  });
  const snapshot = accounts
    .filter((a) => a.snapshots.length > 0)
    .map((a) => {
      const s = a.snapshots[0];
      return { accountId: a.id, gameName: a.gameName, tagLine: a.tagLine, tier: s.tier, lpScore: getLpScore(s), leaguePoints: s.leaguePoints };
    });

  return NextResponse.json({
    syncing: syncingRankings.has(workspace.id),
    lastSyncedAt: mostRecent._max.capturedAt?.toISOString() ?? null,
    snapshot,
  });
}

// Manual sync trigger (design D11): requires ADMIN role or higher on the target ranking — a
// VIEWER or unauthenticated caller must not be able to spend the Riot API budget. Runs only
// that ranking's accounts (`--ranking <id>` passed as its own argv element, never through a
// shell) so triggering one ranking's sync never fires another ranking's alerts.
export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("ranking") ?? "";
  const result = await requireRankingRoleApi(slug, "ADMIN");
  if (isPolicyDenial(result)) return result;
  const ranking = result.ranking;

  if (syncingRankings.has(ranking.id)) {
    return NextResponse.json({ status: "already-running" }, { status: 429 });
  }
  syncingRankings.add(ranking.id);

  const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
  const pollScript = path.join(process.cwd(), "scripts", "poll.ts");

  const child = spawn(tsxBin, [pollScript, "--ranking", ranking.id], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
  });

  child.on("exit", () => {
    syncingRankings.delete(ranking.id);
  });
  child.on("error", (err) => {
    console.error("Manual sync failed to start:", err);
    syncingRankings.delete(ranking.id);
  });

  return NextResponse.json({ status: "started" });
}
