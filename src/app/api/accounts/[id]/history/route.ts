import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLpScore } from "@/lib/rank-order";
import { requireRankingViewApi, isPolicyDenial } from "@/lib/ranking-policy";

// Ranking-scoped profile history: ?ws=<slug> resolves the tenant and canView gates it (design
// D5/D6/D8) so a known accountId can never leak snapshots from another (or a PRIVATE) ranking.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const slug = request.nextUrl.searchParams.get("ws") ?? "";
  const result = await requireRankingViewApi(slug);
  if (isPolicyDenial(result)) return result;
  const workspace = result.ranking;

  const queueType = request.nextUrl.searchParams.get("queue") ?? "RANKED_SOLO_5x5";

  const snapshots = await prisma.rankSnapshot.findMany({
    where: { accountId: id, queueType, rankingId: workspace.id },
    orderBy: { capturedAt: "asc" },
  });

  const history = snapshots.map((snapshot) => ({
    ...snapshot,
    lpScore: getLpScore(snapshot),
  }));

  return NextResponse.json(history);
}