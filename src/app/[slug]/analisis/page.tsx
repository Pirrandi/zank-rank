import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildQueueStats, winrate } from "@/lib/queue-stats";
import { totalLpGained } from "@/lib/derive";
import { getLpScore } from "@/lib/rank-order";
import { getQueueSnapshotSummaries } from "@/lib/snapshot-summary";
import { getProfileIconUrl } from "@/lib/ddragon";
import { formatDateTime } from "@/lib/relative-time";
import { requireRankingView } from "@/lib/ranking-policy";
import { PrivateRankingGate } from "@/app/private-ranking-gate";
import { RankingShell } from "../_ui/shell/ranking-shell";

export const dynamic = "force-dynamic";

type Grade = "S" | "A" | "B" | "C" | "D" | "F";

const GRADE_COLOR: Record<Grade, string> = {
  S: "#ffd447",
  A: "#4ade80",
  B: "#5eb1f5",
  C: "#e6b53a",
  D: "#ff9a5c",
  F: "#ff5470",
};

// Judgment call: PlayerAnalysis only stores free-text prose (no structured score from
// scripts/analyze.ts), so the letter grade the handoff calls for is computed here from
// winrate + LP trend + hot streak — not stored, recalculated on every render.
function computeGrade(wr: number, lpGained: number | undefined, hotStreak: boolean): Grade {
  let score = wr;
  if (lpGained !== undefined) score += Math.max(-15, Math.min(15, lpGained / 10));
  if (hotStreak) score += 5;
  if (score >= 70) return "S";
  if (score >= 60) return "A";
  if (score >= 50) return "B";
  if (score >= 40) return "C";
  if (score >= 30) return "D";
  return "F";
}

export default async function AnalisisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireRankingView(slug, `/${slug}/analisis`);
  if (!access.canView) {
    return (
      <RankingShell slug={slug} access={access} path={`/${slug}/analisis`}>
        <PrivateRankingGate />
      </RankingShell>
    );
  }
  const workspace = access.ranking;

  const accounts = await prisma.trackedAccount.findMany({
    where: { rankingId: workspace.id },
    include: { analysis: true },
  });
  // Bounded per-account summary (first/baseline/last two) instead of the full snapshot series.
  const summaries = await getQueueSnapshotSummaries(
    accounts.filter((a) => a.analysis).map((a) => a.id),
    ["RANKED_SOLO_5x5"]
  );


  const rows = await Promise.all(
    accounts
      .filter((a) => a.analysis)
      .map(async (a) => {
        const soloSnapshotsAsc = summaries.get(`${a.id}:RANKED_SOLO_5x5`)?.ascending ?? [];
        const soloSnapshotsDesc = [...soloSnapshotsAsc].reverse();
        const stats = buildQueueStats(soloSnapshotsDesc);
        const wr = stats ? Number(winrate(stats.wins, stats.losses).replace("%", "")) || 0 : 0;
        const lpGained = totalLpGained(soloSnapshotsAsc);
        const grade = computeGrade(wr, lpGained, stats?.hotStreak ?? false);
        return {
          id: a.id,
          gameName: a.gameName,
          tagLine: a.tagLine,
          profileIconUrl: a.profileIconId !== null ? await getProfileIconUrl(a.profileIconId) : undefined,
          text: a.analysis!.text,
          generatedAt: a.analysis!.generatedAt,
          grade,
          lpScore: stats ? getLpScore(stats) : -1,
        };
      })
  );

  rows.sort((a, b) => b.lpScore - a.lpScore);

  return (
    <RankingShell slug={slug} access={access} path={`/${slug}/analisis`}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: 8, color: "var(--color-accent)", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Análisis
        </div>
        <h1 style={{ fontSize: 36, margin: "0 0 32px" }}>Scouting diario</h1>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: "24px 20px", color: "var(--color-neutral-600)", fontSize: 14 }}>
            Todavía no hay análisis generados. Corré <code>npm run analyze</code> (o esperá al cron diario).
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/${slug}/players/${r.id}`}
                className="card"
                style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {r.profileIconUrl ? (
                    <img src={r.profileIconUrl} alt={r.gameName} width={40} height={40} style={{ borderRadius: "50%", flex: "none" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--color-neutral-200)", flex: "none" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      {r.gameName}
                      <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{r.tagLine}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>Hoy · {formatDateTime(r.generatedAt)}</div>
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: GRADE_COLOR[r.grade], flex: "none" }}
                  >
                    {r.grade}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>{r.text}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </RankingShell>
  );
}
