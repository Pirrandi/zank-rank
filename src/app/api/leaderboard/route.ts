import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareRankNullable, type RankLike } from "@/lib/rank-order";
import { getLatestSnapshot } from "@/lib/snapshot-summary";
import { requireRankingViewApi, isPolicyDenial } from "@/lib/ranking-policy";

type QueueStats = RankLike & {
  wins: number;
  losses: number;
  hotStreak: boolean;
  capturedAt: Date;
};

// Ranking-scoped leaderboard: ?ws=<slug> resolves the tenant and canView gates it (design
// D5/D6) — a PRIVATE ranking's leaderboard 404s the same way an unknown slug does.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("ws") ?? "";
  const result = await requireRankingViewApi(slug);
  if (isPolicyDenial(result)) return result;
  const workspace = result.ranking;

  const accounts = await prisma.trackedAccount.findMany({ where: { rankingId: workspace.id } });

  // Latest snapshot per queue only (indexed), never the full history.
  const queueTypes = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"];
  const latestByAccount = await Promise.all(
    accounts.map(async (account) => (await Promise.all(queueTypes.map((q) => getLatestSnapshot(account.id, q)))).flatMap((s) => (s ? [s] : [])))
  );

  const leaderboard = accounts.map((account, index) => {
    const queues: Record<string, QueueStats> = {};

    for (const snapshot of latestByAccount[index]) {
      queues[snapshot.queueType] = {
        tier: snapshot.tier,
        rank: snapshot.rank,
        leaguePoints: snapshot.leaguePoints,
        wins: snapshot.wins,
        losses: snapshot.losses,
        hotStreak: false,
        capturedAt: snapshot.capturedAt,
      };
    }

    return {
      id: account.id,
      gameName: account.gameName,
      tagLine: account.tagLine,
      queues,
    };
  });

  leaderboard.sort((a, b) =>
    compareRankNullable(a.queues.RANKED_SOLO_5x5, b.queues.RANKED_SOLO_5x5)
  );

  return NextResponse.json(leaderboard);
}