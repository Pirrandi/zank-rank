import { prisma } from "@/lib/prisma";
import { tierLabel } from "@/lib/tier-colors";
import { TIERS } from "@/lib/rank-order";
import { formatDateTime } from "@/lib/relative-time";
import { requireRankingView } from "@/lib/ranking-policy";
import { PrivateRankingGate } from "@/app/private-ranking-gate";
import { RankingShell } from "../_ui/shell/ranking-shell";
import { BotPanel, BotMessage } from "./bot-panel";

export const dynamic = "force-dynamic";

function tierIndex(tier: string): number {
  const i = TIERS.indexOf(tier.toUpperCase() as (typeof TIERS)[number]);
  return i === -1 ? 0 : i;
}

export default async function BotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireRankingView(slug, `/${slug}/bot`);
  if (!access.canView) {
    return (
      <RankingShell slug={slug} access={access} path={`/${slug}/bot`}>
        <PrivateRankingGate />
      </RankingShell>
    );
  }
  const workspace = access.ranking;

  const accounts = await prisma.trackedAccount.findMany({ where: { rankingId: workspace.id } });

  // Tier changes (the first snapshot plus every snapshot whose tier differs from the previous
  // one, per account) computed in SQL, so the full snapshot series never reaches the page.
  const changes = await prisma.$queryRaw<{ accountId: string; tier: string; capturedAt: Date }[]>`
    SELECT accountId, tier, capturedAt FROM (
      SELECT accountId, tier, capturedAt,
             LAG(tier) OVER (PARTITION BY accountId ORDER BY capturedAt) AS prevTier
      FROM RankSnapshot
      WHERE workspaceId = ${workspace.id} AND queueType = 'RANKED_SOLO_5x5'
    ) WHERE prevTier IS NULL OR prevTier <> tier
    ORDER BY accountId, capturedAt`;
  const milestonesByAccount = new Map<string, { capturedAt: Date; tier: string }[]>();
  for (const c of changes) {
    const list = milestonesByAccount.get(c.accountId) ?? [];
    list.push({ capturedAt: new Date(c.capturedAt), tier: c.tier });
    milestonesByAccount.set(c.accountId, list);
  }

  // Judgment call: we don't persist the exact messages the bot sent historically, so this
  // feed is reconstructed from real tier-change milestones instead of fabricated copy.
  type FeedRow = { key: string; content: string; accent: string; when: Date };
  const rows: FeedRow[] = [];

  for (const account of accounts) {
    const milestones = milestonesByAccount.get(account.id) ?? [];
    for (let i = 1; i < milestones.length; i++) {
      const prev = milestones[i - 1];
      const curr = milestones[i];
      const up = tierIndex(curr.tier) > tierIndex(prev.tier);
      rows.push({
        key: `${account.id}-${curr.capturedAt.toISOString()}`,
        content: up
          ? `🎉 ¡${account.gameName}#${account.tagLine} subió a **${tierLabel(curr.tier, "IV")}**!`
          : `💩 ${account.gameName}#${account.tagLine} bajó a ${tierLabel(curr.tier, "IV")}...`,
        accent: up ? "var(--color-win)" : "var(--color-loss)",
        when: curr.capturedAt,
      });
    }
  }

  rows.sort((a, b) => b.when.getTime() - a.when.getTime());
  const feed = rows.slice(0, 10);

  return (
    <RankingShell slug={slug} access={access} path={`/${slug}/bot`}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 8, color: "var(--color-accent)", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Bot
        </div>
        <h1 style={{ fontSize: 36, margin: "0 0 8px" }}>#ranked-avisos</h1>
        <p style={{ color: "var(--color-neutral-600)", fontSize: 14, marginBottom: 32, maxWidth: 560 }}>
          Preview de lo que postea el bot — el feed de abajo se arma con cambios de rango reales, no son mensajes inventados.
        </p>

        <BotPanel slug={slug} accounts={accounts.map((a) => ({ id: a.id, gameName: a.gameName, tagLine: a.tagLine }))} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          {feed.length === 0 ? (
            <div className="card" style={{ padding: "20px", color: "var(--color-neutral-600)", fontSize: 13 }}>
              Todavía no hay cambios de rango registrados.
            </div>
          ) : (
            feed.map((f) => <BotMessage key={f.key} content={`${f.content}\n${formatDateTime(f.when)}`} accent={f.accent} kind="Avisos de rango" />)
          )}
        </div>
      </div>
    </RankingShell>
  );
}
