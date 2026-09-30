import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { buildQueueStats, type QueueStats } from "@/lib/queue-stats";
import { winStreak } from "@/lib/derive";
import { getQueueSnapshotSummaries, getSparklines } from "@/lib/snapshot-summary";
import { getLatestVersion } from "@/lib/ddragon";
import { getRecentMatches, type RecentMatch } from "@/lib/recent-matches";
import { championIconUrl } from "@/lib/champion-assets";
import { formatRelativeTime } from "@/lib/relative-time";
import { getBiggestPentaKill, getTopQuadraKills, getTopTripleKills, getTopEpicSteals, getShameHighlights, getWorstGame, getHotStreakPlayers, getBestDuoOfWeek, type DuoOfWeek } from "@/lib/highlights";
import { RANKED_QUEUES, type RankedQueueParam } from "@/lib/queues";
import { ROOT_SLUG } from "@/lib/ranking";
import { roleAtLeast } from "@/lib/ranking-access";
import { requireRankingView } from "@/lib/ranking-policy";
import { LadderBoard, type PlayerRow } from "@/app/ladder-board";
import { PrivateRankingGate } from "@/app/private-ranking-gate";
import { RankingShell } from "./_ui/shell/ranking-shell";

type WallItem = {
  kind: "fama" | "verguenza";
  glyph: string;
  label: string;
  id: string;
  gameName: string;
  tagLine: string;
  queueParam: RankedQueueParam;
  value: string;
  roast: string;
};

export const dynamic = "force-dynamic";

const QUEUE_IDS: Record<string, number> = {
  [RANKED_QUEUES.solo.type]: RANKED_QUEUES.solo.queueId,
  [RANKED_QUEUES.flex.type]: RANKED_QUEUES.flex.queueId,
};

// The "Últimos en los muros" preview for one ranked queue — same records as /muros?cola=<queue>.
async function buildWallsPreview(rankingId: string, queue: RankedQueueParam): Promise<WallItem[]> {
  const [shame, pentaKill, topQuadras, topTriples, topSteals, worstGame, hotStreaks] = await Promise.all([
    getShameHighlights(rankingId, queue),
    getBiggestPentaKill(rankingId, queue),
    getTopQuadraKills(rankingId, queue),
    getTopTripleKills(rankingId, queue),
    getTopEpicSteals(rankingId, queue),
    getWorstGame(rankingId, queue),
    getHotStreakPlayers(rankingId, queue),
  ]);
  const topStreak = shame.streaks[0];
  const topWinStreak = shame.winStreaks[0];
  const topDrop = shame.drops[0];
  const hotStreak = hotStreaks[0];

  const wallItems: WallItem[] = [];
  if (topWinStreak) {
    wallItems.push({
      kind: "fama",
      glyph: `W${topWinStreak.streak}`,
      label: "Racha de victorias activa",
      id: topWinStreak.id,
      gameName: topWinStreak.gameName,
      tagLine: topWinStreak.tagLine,
      queueParam: queue,
      value: `${topWinStreak.streak}`,
      roast: "Imparable ahora mismo.",
    });
  }
  if (hotStreak) {
    wallItems.push({
      kind: "fama",
      glyph: "🔥",
      label: "En racha caliente",
      id: hotStreak.id,
      gameName: hotStreak.gameName,
      tagLine: hotStreak.tagLine,
      queueParam: queue,
      value: `${hotStreak.leaguePoints} LP`,
      roast: "Riot mismo lo marcó en llamas.",
    });
  }
  if (worstGame) {
    wallItems.push({
      kind: "verguenza",
      glyph: `${worstGame.deaths}D`,
      label: "Más muertes en una partida",
      id: worstGame.id,
      gameName: worstGame.gameName,
      tagLine: worstGame.tagLine,
      queueParam: queue,
      value: `${worstGame.deaths}`,
      roast: `Feedeó con ${worstGame.championName} y no fue poco.`,
    });
  }
  if (pentaKill) {
    wallItems.push({
      kind: "fama",
      glyph: "PK",
      label: "Pentakill más reciente",
      id: pentaKill.id,
      gameName: pentaKill.gameName,
      tagLine: pentaKill.tagLine,
      queueParam: queue,
      value: "x1",
      roast: "Se cree Faker.",
    });
  }
  if (topStreak) {
    wallItems.push({
      kind: "verguenza",
      glyph: `L${topStreak.streak}`,
      label: "Racha de derrotas activa",
      id: topStreak.id,
      gameName: topStreak.gameName,
      tagLine: topStreak.tagLine,
      queueParam: queue,
      value: `${topStreak.streak}`,
      roast: "No hay quien lo pare, pero para mal.",
    });
  }
  if (topQuadras) {
    wallItems.push({
      kind: "fama",
      glyph: "4K",
      label: "Rey de los cuádruples",
      id: topQuadras.id,
      gameName: topQuadras.gameName,
      tagLine: topQuadras.tagLine,
      queueParam: queue,
      value: `x${topQuadras.value}`,
      roast: "A un kill de ser leyenda.",
    });
  }
  if (topDrop) {
    wallItems.push({
      kind: "verguenza",
      glyph: "LP↓",
      label: `Caída de LP (${topDrop.windowHours}h)`,
      id: topDrop.id,
      gameName: topDrop.gameName,
      tagLine: topDrop.tagLine,
      queueParam: queue,
      value: `-${topDrop.amount}`,
      roast: "En caída libre.",
    });
  }
  if (topTriples) {
    wallItems.push({
      kind: "fama",
      glyph: "3K",
      label: "Rey de los triples",
      id: topTriples.id,
      gameName: topTriples.gameName,
      tagLine: topTriples.tagLine,
      queueParam: queue,
      value: `x${topTriples.value}`,
      roast: "Sabe cuándo hacer daño.",
    });
  }
  if (topSteals) {
    wallItems.push({
      kind: "fama",
      glyph: "RB",
      label: "Ladrón de objetivos",
      id: topSteals.id,
      gameName: topSteals.gameName,
      tagLine: topSteals.tagLine,
      queueParam: queue,
      value: `x${topSteals.value}`,
      roast: "Le robó el alma al enemigo.",
    });
  }
  return wallItems.slice(0, 4);
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await requireRankingView(slug, `/${slug}`);
  if (!access.canView) {
    return (
      <RankingShell slug={slug} access={access} path={`/${slug}`}>
        <PrivateRankingGate />
      </RankingShell>
    );
  }
  const workspace = access.ranking;

  // Owner detection para el hub de gestión (design D2/D5: hub en la propia ranking). El nombre
  // "isOwner" es histórico (pre-roles); hoy significa "tiene rol ADMIN o superior en esta
  // ranking" — ranking-access.ts es la fuente de verdad de los roles.
  const isOwner = roleAtLeast(access.role, "ADMIN");

  const accounts = await prisma.trackedAccount.findMany({
    where: { rankingId: workspace.id },
    include: {
      participations: { include: { match: true } },
    },
  });

  // Only a handful of snapshot rows per (account, queue) are needed — never the full series.
  const ladderQueues = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"];
  const [summaries, sparklines] = await Promise.all([
    getQueueSnapshotSummaries(accounts.map((a) => a.id), ladderQueues),
    getSparklines(workspace.id, ladderQueues),
  ]);

  const ddragonVersion = await getLatestVersion();

  const rows: PlayerRow[] = accounts.map((account) => {
    const profileIconUrl =
      account.profileIconId !== null
        ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${account.profileIconId}.png`
        : undefined;

    const buildRowQueue = (
      queueType: string
    ): (QueueStats & { winStreakCount: number; hasMatchData: boolean; sparkline: number[]; recentForm: boolean[] }) | undefined => {
      const summary = summaries.get(`${account.id}:${queueType}`);
      if (!summary) return undefined;
      const stats = buildQueueStats([...summary.ascending].reverse());
      if (!stats) return undefined;

      const queueMatches = account.participations
        .filter((p) => p.match.queueId === QUEUE_IDS[queueType])
        .sort((a, b) => b.match.gameCreation.getTime() - a.match.gameCreation.getTime());

      // Cached series may lag a poll behind: always end it on the current LP score.
      const sparkline = [...(sparklines.get(`${account.id}:${queueType}`) ?? [])];
      if (sparkline[sparkline.length - 1] !== stats.lpScore) sparkline.push(stats.lpScore);
      const recentForm = [...queueMatches.slice(0, 5)].reverse().map((m) => m.win);

      return {
        ...stats,
        winStreakCount: winStreak(queueMatches),
        hasMatchData: queueMatches.length > 0,
        sparkline,
        recentForm,
      };
    };

    return {
      id: account.id,
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconUrl,
      inGame: account.inGame,
      solo: buildRowQueue("RANKED_SOLO_5x5"),
      flex: buildRowQueue("RANKED_FLEX_SR"),
    };
  });

  const iconById = new Map(rows.map((r) => [r.id, r.profileIconUrl]));
  const [soloWalls, flexWalls, soloDuo, flexDuo, soloRecent, flexRecent] = await Promise.all([
    buildWallsPreview(workspace.id, "solo"),
    buildWallsPreview(workspace.id, "flex"),
    getBestDuoOfWeek(workspace.id, "solo"),
    getBestDuoOfWeek(workspace.id, "flex"),
    getRecentMatches(workspace.id, "solo"),
    getRecentMatches(workspace.id, "flex"),
  ]);
  const inGameNow = rows.filter((r) => r.inGame);
  const duoOfWeek = [soloDuo, flexDuo].filter((d): d is DuoOfWeek => Boolean(d));

  let vsSlot: ReactNode = null;

  return (
    <RankingShell slug={slug} access={access} path={`/${slug}`}>
      {duoOfWeek.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          {duoOfWeek.map((duo) => (
            <DuoOfWeekCard key={duo.queueParam} duo={duo} />
          ))}
        </div>
      )}
      {inGameNow.length > 0 && <InGameStrip slug={slug} players={inGameNow} />}
      {isOwner && accounts.length === 0 ? (
        <WorkspaceEmptyHub slug={slug} />
      ) : (
        <LadderBoard
          slug={slug}
          rows={rows}
          sidebarByQueue={{
            solo: (
              <SidebarStack>
                <WallsPreview slug={slug} queue="solo" items={soloWalls} icons={iconById} />
                <RecentMatchesCard slug={slug} matches={soloRecent} />
              </SidebarStack>
            ),
            flex: (
              <SidebarStack>
                <WallsPreview slug={slug} queue="flex" items={flexWalls} icons={iconById} />
                <RecentMatchesCard slug={slug} matches={flexRecent} />
              </SidebarStack>
            ),
          }}
        />
      )}
      {vsSlot}
    </RankingShell>
  );
}

// Estado vacío del workspace propio (recién creado tras el login de Discord, sin cuentas
// trackeadas todavía): hub de gestión con el CTA principal (agregar jugadores) y los
// accesos al panel admin. Server component, sin lógica de auth — el panel admin ya
// protege /admin por su cuenta (getAdminSession).
function WorkspaceEmptyHub({ slug }: { slug: string }) {
  return (
    <div
      className="card"
      style={{
        padding: "clamp(40px, 6vw, 72px) 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-accent)",
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        Tu workspace
      </div>
      <h1 style={{ fontSize: "clamp(24px, 3.4vw, 34px)", letterSpacing: "-0.03em", margin: 0 }}>
        Tu ranking está vacío
      </h1>
      <p style={{ maxWidth: 500, margin: "10px 0 28px", fontSize: 15, lineHeight: 1.6, color: "var(--color-neutral-600)" }}>
        Sumá las cuentas de tu equipo para empezar a rankear. El bot las sigue solo y tu
        ranking se arma solo con cada partida.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href={`/${slug}/admin/accounts`}
          className="btn btn-primary"
          style={{ minHeight: 46, padding: "10px 24px", fontSize: 15, textDecoration: "none" }}
        >
          Agregar jugadores
        </Link>
        <Link
          href={`/${slug}/admin`}
          className="btn"
          style={{ minHeight: 46, padding: "10px 24px", fontSize: 15, textDecoration: "none" }}
        >
          Configurar tu panel
        </Link>
      </div>
      <Link
        href={`/${ROOT_SLUG}`}
        style={{ marginTop: 22, fontSize: 13, fontWeight: 700, color: "var(--color-text-dim)", textDecoration: "none" }}
      >
        Ver el ranking default ↗
      </Link>
    </div>
  );
}

function WallsPreview({ slug, queue, items, icons }: { slug: string; queue: RankedQueueParam; items: WallItem[]; icons: Map<string, string | undefined> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-600)", fontWeight: 800 }}>
          Últimos en los muros
        </div>
        <Link href={`/${slug}/muros?cola=${queue}`} className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--color-accent)", textDecoration: "none" }}>
          Ver todo →
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <WallPreviewCard key={`${item.kind}-${item.id}-${item.glyph}`} item={item} slug={slug} iconUrl={icons.get(item.id)} />
        ))}
      </div>
    </div>
  );
}

function WallPreviewCard({ item, slug, iconUrl }: { item: WallItem; slug: string; iconUrl?: string }) {
  const isFama = item.kind === "fama";
  const accent = isFama ? "var(--color-win)" : "var(--color-loss)";
  const href = `/${slug}/players/${item.id}?queue=${item.queueParam}`;

  return (
    <Link
      href={href}
      className="card"
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        textDecoration: "none",
        color: "inherit",
        borderColor: accent,
      }}
    >
      <div
        className="mono"
        style={{
          flex: "none",
          width: 36,
          height: 36,
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: accent,
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        }}
      >
        {item.glyph}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 600,
            marginBottom: 2,
          }}
        >
          {isFama ? "Fama" : "Vergüenza"} · {item.label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 15, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="" width={20} height={20} style={{ flex: "none", borderRadius: 6 }} />
          )}
          {item.gameName}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4, color: "var(--color-neutral-700)" }}>{item.roast}</div>
      </div>
      <div className="mono" style={{ flex: "none", fontWeight: 700, fontSize: 22, color: accent, alignSelf: "center" }}>
        {item.value}
      </div>
    </Link>
  );
}

function DuoOfWeekCard({ duo }: { duo: DuoOfWeek }) {
  const accent = "var(--color-win)";

  return (
    <div
      className="card"
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        borderColor: accent,
        flex: "1 1 260px",
      }}
    >
      <div
        className="mono"
        style={{
          flex: "none",
          width: 36,
          height: 36,
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          color: accent,
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        }}
      >
        🤝
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 600,
            marginBottom: 2,
          }}
        >
          Dúo de la semana · {duo.queueLabel}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {duo.a.gameName} y {duo.b.gameName}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4, color: "var(--color-neutral-700)" }}>
          Ganaron juntos esta semana.
        </div>
      </div>
      <div className="mono" style={{ flex: "none", fontWeight: 700, fontSize: 22, color: accent, alignSelf: "center" }}>
        {duo.wins}
      </div>
    </div>
  );
}

function SidebarStack({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>;
}

function RecentMatchesCard({ slug, matches }: { slug: string; matches: RecentMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-600)", fontWeight: 800 }}>
        Últimas partidas
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {matches.map((m) => {
          const accent = m.win ? "var(--color-win)" : "var(--color-loss)";
          return (
            <Link
              key={m.key}
              href={`/${slug}/players/${m.accountId}`}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", textDecoration: "none", color: "inherit", borderColor: accent }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={championIconUrl(m.championName)} alt={m.championName} width={32} height={32} style={{ flex: "none", borderRadius: 8 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.gameName}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>
                  {m.kills}/{m.deaths}/{m.assists} · {m.durationMinutes} min · {formatRelativeTime(m.gameCreation)}
                </div>
              </div>
              <div className="mono" style={{ flex: "none", fontWeight: 800, fontSize: 12, color: accent }}>
                {m.win ? "V" : "D"}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function InGameStrip({ slug, players }: { slug: string; players: PlayerRow[] }) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", marginBottom: 24, borderColor: "var(--color-win)" }}>
      <div
        className="mono"
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-win)", fontWeight: 700 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-win)" }} />
        Jugando ahora
      </div>
      {players.map((p) => (
        <Link
          key={p.id}
          href={`/${slug}/players/${p.id}`}
          style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: "inherit", textDecoration: "none" }}
        >
          {p.profileIconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.profileIconUrl} alt="" width={22} height={22} style={{ flex: "none", borderRadius: 6 }} />
          )}
          {p.gameName}
        </Link>
      ))}
    </div>
  );
}
