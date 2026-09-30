import { getBiggestPentaKill, getTopQuadraKills, getTopTripleKills, getTopEpicSteals, getShameHighlights, getWorstGame, getHotStreakPlayers } from "@/lib/highlights";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLatestVersion } from "@/lib/ddragon";
import { RANKED_QUEUES, parseRankedQueueParam, type RankedQueueParam } from "@/lib/queues";
import { requireRankingView } from "@/lib/ranking-policy";
import { PrivateRankingGate } from "@/app/private-ranking-gate";
import { RankingShell } from "../_ui/shell/ranking-shell";
import { RoastCard } from "./roast-card";

export const dynamic = "force-dynamic";

export default async function MurosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cola?: string }>;
}) {
  const { slug } = await params;
  const queue = parseRankedQueueParam((await searchParams).cola);
  const access = await requireRankingView(slug, `/${slug}/muros`);
  if (!access.canView) {
    return (
      <RankingShell slug={slug} access={access} path={`/${slug}/muros`}>
        <PrivateRankingGate />
      </RankingShell>
    );
  }
  const workspace = access.ranking;

  const [pentaKill, topQuadras, topTriples, topSteals, shame, worstGame, hotStreaks] = await Promise.all([
    getBiggestPentaKill(workspace.id, queue),
    getTopQuadraKills(workspace.id, queue),
    getTopTripleKills(workspace.id, queue),
    getTopEpicSteals(workspace.id, queue),
    getShameHighlights(workspace.id, queue),
    getWorstGame(workspace.id, queue),
    getHotStreakPlayers(workspace.id, queue),
  ]);

  const [iconRows, ddragonVersion] = await Promise.all([
    prisma.trackedAccount.findMany({ where: { rankingId: workspace.id, profileIconId: { not: null } }, select: { id: true, profileIconId: true } }),
    getLatestVersion(),
  ]);
  const iconById = new Map(iconRows.map((a) => [a.id, `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${a.profileIconId}.png`]));

  const topWinStreaks = shame.winStreaks.slice(0, 5);
  const topGains = shame.gains.slice(0, 5);
  const topStreaks = shame.streaks.slice(0, 5);
  const topDrops = shame.drops.slice(0, 5);

  return (
    <RankingShell slug={slug} access={access} path={`/${slug}/muros`}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: 8, color: "var(--color-accent)", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Muros
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 32 }}>
          <h1 style={{ fontSize: 36, margin: 0 }}>Fama y Vergüenza</h1>
          <QueueToggle slug={slug} queue={queue} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
          <div>
            <div style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-win)", fontWeight: 800, marginBottom: 16 }}>
              🏆 Muro de la Fama
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topWinStreaks.map((s, i) => (
                <RoastCard slug={slug} queue={queue} key={`winstreak-${s.id}-${s.queueParam}`} kind="fame" emoji={i === 0 ? "🔥" : "✅"} label="Racha de victorias" id={s.id} iconUrl={iconById.get(s.id)} gameName={s.gameName} tagLine={s.tagLine} value={`${s.streak}`} unit={`victorias seguidas · ${s.queueLabel}`} initialRoast="Imparable ahora mismo." accent="var(--color-win)" />
              ))}
              {hotStreaks.slice(0, 3).map((h) => (
                <RoastCard slug={slug} queue={queue} key={`hotstreak-${h.id}`} kind="fame" emoji="🔥" label="En racha caliente" id={h.id} iconUrl={iconById.get(h.id)} gameName={h.gameName} tagLine={h.tagLine} value={`${h.leaguePoints}`} unit={`LP · Riot lo marca en llamas`} initialRoast="Riot mismo lo puso en llamas." accent="var(--color-win)" />
              ))}
              {topGains.map((g, i) => (
                <RoastCard slug={slug} queue={queue} key={`gain-${g.id}-${g.queueParam}`} kind="fame" emoji={i === 0 ? "📈" : "📊"} label={`Mayor subida de LP (${g.windowHours}h)`} id={g.id} iconUrl={iconById.get(g.id)} gameName={g.gameName} tagLine={g.tagLine} value={`+${g.amount}`} unit={`LP · ${g.queueLabel}`} initialRoast="En racha imparable." accent="var(--color-win)" />
              ))}
              {pentaKill && (
                <RoastCard slug={slug} queue={queue} kind="fame" emoji="🐉" label="Pentakill" id={pentaKill.id} iconUrl={iconById.get(pentaKill.id)} gameName={pentaKill.gameName} tagLine={pentaKill.tagLine} value="x1" unit={`con ${pentaKill.championName}`} initialRoast="Se cree Faker." accent="var(--color-win)" />
              )}
              {topQuadras && (
                <RoastCard slug={slug} queue={queue} kind="fame" emoji="💥" label="Rey de los cuádruples" id={topQuadras.id} iconUrl={iconById.get(topQuadras.id)} gameName={topQuadras.gameName} tagLine={topQuadras.tagLine} value={`x${topQuadras.value}`} unit={`cuádruples · mejor con ${topQuadras.championName}`} initialRoast="A un kill de ser leyenda." accent="var(--color-win)" />
              )}
              {topTriples && (
                <RoastCard slug={slug} queue={queue} kind="fame" emoji="⚔️" label="Rey de los triples" id={topTriples.id} iconUrl={iconById.get(topTriples.id)} gameName={topTriples.gameName} tagLine={topTriples.tagLine} value={`x${topTriples.value}`} unit={`triples · mejor con ${topTriples.championName}`} initialRoast="Sabe cuándo hacer daño." accent="var(--color-win)" />
              )}
              {topSteals && (
                <RoastCard slug={slug} queue={queue} kind="fame" emoji="🥷" label="Ladrón de objetivos" id={topSteals.id} iconUrl={iconById.get(topSteals.id)} gameName={topSteals.gameName} tagLine={topSteals.tagLine} value={`x${topSteals.value}`} unit={`robos épicos · con ${topSteals.championName}`} initialRoast="Le robó el alma al enemigo." accent="var(--color-win)" />
              )}
              {topWinStreaks.length === 0 && hotStreaks.length === 0 && topGains.length === 0 && !pentaKill && !topQuadras && !topTriples && !topSteals && (
                <div className="card" style={{ padding: "20px", color: "var(--color-neutral-600)", fontSize: 13 }}>Todavía no hay nada que celebrar.</div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-loss)", fontWeight: 800, marginBottom: 16 }}>
              💀 Muro de la Vergüenza
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topStreaks.map((s, i) => (
                <RoastCard slug={slug} queue={queue} key={`streak-${s.id}-${s.queueParam}`} kind="shame" emoji={i === 0 ? "😭" : "😬"} label="Racha activa" id={s.id} iconUrl={iconById.get(s.id)} gameName={s.gameName} tagLine={s.tagLine} value={`${s.streak}`} unit={`derrotas · ${s.queueLabel}`} initialRoast="No hay quien lo pare, pero para mal." accent="var(--color-loss)" />
              ))}
              {topDrops.map((d, i) => (
                <RoastCard slug={slug} queue={queue} key={`drop-${d.id}-${d.queueParam}`} kind="shame" emoji={i === 0 ? "📉" : "📊"} label={`Caída de LP (${d.windowHours}h)`} id={d.id} iconUrl={iconById.get(d.id)} gameName={d.gameName} tagLine={d.tagLine} value={`-${d.amount}`} unit={`LP · ${d.queueLabel}`} initialRoast="En caída libre." accent="var(--color-loss)" />
              ))}
              {worstGame && (
                <RoastCard slug={slug} queue={queue} kind="shame" emoji="💀" label="Más muertes en una partida" id={worstGame.id} iconUrl={iconById.get(worstGame.id)} gameName={worstGame.gameName} tagLine={worstGame.tagLine} value={`${worstGame.deaths}`} unit={`muertes · ${worstGame.kills}/${worstGame.deaths}/${worstGame.assists} con ${worstGame.championName}`} initialRoast="Feedeó y no fue poco." accent="var(--color-loss)" />
              )}
              {topStreaks.length === 0 && topDrops.length === 0 && !worstGame && (
                <div className="card" style={{ padding: "20px", color: "var(--color-neutral-600)", fontSize: 13 }}>Nadie se merece este muro hoy.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RankingShell>
  );
}

function QueueToggle({ slug, queue }: { slug: string; queue: RankedQueueParam }) {
  return (
    <nav className="seg" aria-label="Cola de los muros">
      {Object.values(RANKED_QUEUES).map((q) => (
        <Link key={q.param} href={`/${slug}/muros?cola=${q.param}`} className="seg-opt" aria-current={q.param === queue ? "page" : undefined} scroll={false}>
          {q.label}
        </Link>
      ))}
    </nav>
  );
}
