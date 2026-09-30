import { notFound } from "next/navigation";
import type { RankSnapshot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQueueStats, type QueueStats } from "@/lib/queue-stats";
import { compareRankNullable, getLpScore } from "@/lib/rank-order";
import { getCustomMatchups } from "@/lib/customs";
import { getProfileIconUrl } from "@/lib/ddragon";
import { championIconUrl, championSplashUrl } from "@/lib/champion-assets";
import { formatRelativeTime } from "@/lib/relative-time";
import { TIER_COLORS, tierEmblemUrl, tierLabel } from "@/lib/tier-colors";
import {
  DAY_MS,
  QUEUE_ID_BY_TYPE,
  averageKda,
  compressLpHistory,
  computeBadges,
  matchLpDelta,
  type ParticipationWithMatch,
} from "@/lib/player-profile";
import { RANKED_QUEUES, parseMatchQueueFilter, queueLabel, type MatchQueueFilter } from "@/lib/queues";
import { requireRankingView } from "@/lib/ranking-policy";
import { PrivateRankingGate } from "@/app/private-ranking-gate";
import { RankingShell } from "../../_ui/shell/ranking-shell";
import { ProfileView, type ProfileViewData } from "../../_ui/profile/profile-view";
import type { Comparable, RivalComparable } from "../../_ui/profile/rival-compare";
import type { MatchQueueOption, RecentMatchRow } from "../../_ui/profile/recent-matches-card";
import { formatDuration } from "../../_ui/common/format";

export const dynamic = "force-dynamic";

const SOLO = "RANKED_SOLO_5x5";
const FLEX = "RANKED_FLEX_SR";
const APEX = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);
const RECENT_MATCHES = 8;
const KDA_SAMPLE = 20;

async function safeProfileIcon(profileIconId: number | null): Promise<string | undefined> {
  if (profileIconId === null) return undefined;
  try {
    return await getProfileIconUrl(profileIconId);
  } catch {
    return undefined;
  }
}

function mostPlayedChampion(parts: ParticipationWithMatch[]): string | undefined {
  const counts = new Map<string, number>();
  for (const p of parts) counts.set(p.championName, (counts.get(p.championName) ?? 0) + 1);
  let best: string | undefined;
  let bestCount = 0;
  for (const [name, n] of counts) {
    if (n > bestCount) {
      best = name;
      bestCount = n;
    }
  }
  return best;
}

const MATCH_QUEUE_FILTERS: { key: MatchQueueFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "solo", label: RANKED_QUEUES.solo.label },
  { key: "flex", label: RANKED_QUEUES.flex.label },
];

// Links for the "Últimas partidas" queue filter; every other search param (?queue, ?vs) is kept.
function matchQueueOptions(path: string, current: Record<string, string | undefined>, active: MatchQueueFilter): MatchQueueOption[] {
  return MATCH_QUEUE_FILTERS.map(({ key, label }) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) if (v !== undefined && k !== "cola") params.set(k, v);
    if (key !== "todas") params.set("cola", key);
    const qs = params.toString();
    return { key, label, href: qs ? `${path}?${qs}` : path, active: key === active };
  });
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ queue?: string; vs?: string; cola?: string }>;
}) {
  const { slug, id } = await params;
  const search = await searchParams;
  const { queue: queueParam, vs: vsParam } = search;
  const cola = parseMatchQueueFilter(search.cola);
  // Queue of the match history and of the KDA stat (undefined = every queue).
  const colaQueueId = cola === "todas" ? undefined : RANKED_QUEUES[cola].queueId;
  const path = `/${slug}/players/${id}`;

  const access = await requireRankingView(slug, path);
  if (!access.canView) {
    return (
      <RankingShell slug={slug} access={access} path={path}>
        <PrivateRankingGate />
      </RankingShell>
    );
  }
  const rankingId = access.ranking.id;

  const account = await prisma.trackedAccount.findFirst({ where: { id, rankingId }, include: { analysis: true } });
  if (!account) notFound();

  const now = new Date();
  const nowMs = now.getTime();
  const weekAgo = new Date(nowMs - 7 * DAY_MS);
  const monthAgo = new Date(nowMs - 30 * DAY_MS);

  // Everyone: the last 7 days of snapshots (latest rank, "LP hoy" baseline, "Ascenso" badge).
  // The profile's own player also needs 30 days for the LP chart and per-match LP deltas.
  // The history list is filtered and limited in the query itself, so a queue shows its own
  // last RECENT_MATCHES games rather than whatever part of a fixed 8 happens to match.
  const [accounts, weekSnapshots, ownMonthSnapshots, participations, customs, recent] = await Promise.all([
    prisma.trackedAccount.findMany({ where: { rankingId }, orderBy: { createdAt: "asc" } }),
    prisma.rankSnapshot.findMany({ where: { rankingId, capturedAt: { gte: weekAgo } }, orderBy: { capturedAt: "asc" } }),
    prisma.rankSnapshot.findMany({ where: { accountId: id, rankingId, capturedAt: { gte: monthAgo } }, orderBy: { capturedAt: "asc" } }),
    prisma.matchParticipation.findMany({ where: { rankingId }, include: { match: true } }),
    getCustomMatchups(rankingId),
    prisma.matchParticipation.findMany({
      where: { accountId: id, rankingId, ...(colaQueueId === undefined ? {} : { match: { queueId: colaQueueId } }) },
      include: { match: true },
      orderBy: { match: { gameCreation: "desc" } },
      take: RECENT_MATCHES,
    }),
  ]);

  const snapshotsByKey = new Map<string, RankSnapshot[]>();
  for (const s of weekSnapshots) {
    if (s.accountId === id) continue;
    const key = `${s.accountId}:${s.queueType}`;
    const list = snapshotsByKey.get(key) ?? [];
    list.push(s);
    snapshotsByKey.set(key, list);
  }
  for (const s of ownMonthSnapshots) {
    const key = `${id}:${s.queueType}`;
    const list = snapshotsByKey.get(key) ?? [];
    list.push(s);
    snapshotsByKey.set(key, list);
  }
  // Accounts with no snapshot this week (inactive or never ranked): fall back to their
  // latest stored snapshot so their rank still shows.
  await Promise.all(
    accounts.flatMap((a) =>
      [SOLO, FLEX].map(async (queueType) => {
        const key = `${a.id}:${queueType}`;
        if (snapshotsByKey.has(key)) return;
        const latest = await prisma.rankSnapshot.findFirst({ where: { accountId: a.id, queueType }, orderBy: { capturedAt: "desc" } });
        if (latest) snapshotsByKey.set(key, [latest]);
      }),
    ),
  );
  const snaps = (accountId: string, queueType: string) => snapshotsByKey.get(`${accountId}:${queueType}`) ?? [];

  const partsByAccount = new Map<string, ParticipationWithMatch[]>();
  for (const p of participations) {
    const list = partsByAccount.get(p.accountId) ?? [];
    list.push(p);
    partsByAccount.set(p.accountId, list);
  }
  for (const list of partsByAccount.values()) list.sort((a, b) => b.match.gameCreation.getTime() - a.match.gameCreation.getTime());
  const partsOf = (accountId: string) => partsByAccount.get(accountId) ?? [];
  // KDA follows the history's queue filter: average of the last KDA_SAMPLE games of that queue.
  const kdaOf = (accountId: string) =>
    averageKda(
      partsOf(accountId)
        .filter((p) => colaQueueId === undefined || p.match.queueId === colaQueueId)
        .slice(0, KDA_SAMPLE),
    );

  // Primary queue: Solo/Dúo unless the player only plays Flex (or ?queue=flex asks for it).
  const primaryQueue = (accountId: string): string | null => {
    const hasSolo = snaps(accountId, SOLO).length > 0;
    const hasFlex = snaps(accountId, FLEX).length > 0;
    if (queueParam === "flex" && accountId === id && hasFlex) return FLEX;
    if (hasSolo) return SOLO;
    return hasFlex ? FLEX : null;
  };
  const statsOf = (accountId: string): QueueStats | undefined => {
    const q = primaryQueue(accountId);
    return q ? buildQueueStats([...snaps(accountId, q)].reverse()) : undefined;
  };

  const customsOf = (accountId: string) =>
    customs
      .map((m) => {
        const inA = m.teamA.some((p) => p.accountId === accountId);
        const inB = m.teamB.some((p) => p.accountId === accountId);
        if (!inA && !inB) return null;
        const teamAWon = m.teamA[0]?.win ?? false;
        return { match: m, side: inA ? ("A" as const) : ("B" as const), won: inA ? teamAWon : !teamAWon };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

  const badgesOf = (accountId: string) =>
    computeBadges({
      participations: partsOf(accountId),
      snapshotsAscByQueue: [snaps(accountId, SOLO), snaps(accountId, FLEX)],
      versusWinsAt: customsOf(accountId)
        .filter((c) => c.won)
        .map((c) => c.match.gameCreation),
      nowMs,
    });

  const iconEntries = await Promise.all(accounts.map(async (a) => [a.id, await safeProfileIcon(a.profileIconId)] as const));
  const profileIcons = new Map(iconEntries);
  const avatarOf = (accountId: string): string | undefined => {
    const champ = mostPlayedChampion(partsOf(accountId));
    return profileIcons.get(accountId) ?? (champ ? championIconUrl(champ) : undefined);
  };

  const comparableOf = (a: (typeof accounts)[number]): Comparable => {
    const stats = statsOf(a.id);
    const games = stats ? stats.wins + stats.losses : 0;
    return {
      id: a.id,
      name: a.gameName,
      iconUrl: avatarOf(a.id),
      ladder: stats ? getLpScore(stats) : undefined,
      rankLabel: stats ? tierLabel(stats.tier, stats.rank) : "Sin rango",
      lpToday: stats?.delta,
      winrate: stats && games > 0 ? (stats.wins / games) * 100 : undefined,
      kda: kdaOf(a.id),
      games: partsOf(a.id).length,
      badges: badgesOf(a.id).filter((b) => b.unlocked).length,
    };
  };

  // Group order = the Ranking tab's default (Solo/Dúo ladder, unranked last).
  const soloStats = new Map(accounts.map((a) => [a.id, buildQueueStats([...snaps(a.id, SOLO)].reverse())]));
  const ordered = [...accounts].sort((a, b) => compareRankNullable(soloStats.get(a.id), soloStats.get(b.id)));
  const ownIndex = ordered.findIndex((a) => a.id === id);
  const position = soloStats.get(id) ? ownIndex + 1 : null;

  // --- Hero ---
  const ownStats = statsOf(id);
  const tierMeta = ownStats ? TIER_COLORS[ownStats.tier.toUpperCase()] : undefined;
  const tierColor = tierMeta?.fg ?? "#9d99ad";
  const ownParts = partsOf(id);
  const topChampion = mostPlayedChampion(ownParts);
  const ownKda = kdaOf(id);
  const ownGames = ownStats ? ownStats.wins + ownStats.losses : 0;

  // --- Recent matches ---
  const matches: RecentMatchRow[] = recent.map((p) => {
    const company = participations
      .filter((o) => o.matchId === p.matchId && o.accountId !== id && o.teamId === p.teamId)
      .map((o) => accounts.find((a) => a.id === o.accountId)?.gameName)
      .filter((n): n is string => Boolean(n));
    const queueType = Object.keys(QUEUE_ID_BY_TYPE).find((q) => QUEUE_ID_BY_TYPE[q] === p.match.queueId);
    return {
      matchId: p.matchId,
      win: p.win,
      championName: p.championName,
      queueLabel: queueLabel(p.match.queueId),
      iconUrl: championIconUrl(p.championName),
      company,
      kda: `${p.kills}/${p.deaths}/${p.assists}`,
      whenText: formatRelativeTime(p.match.gameCreation),
      durationText: formatDuration(p.match.gameDuration),
      lpDelta: queueType ? matchLpDelta(p, snaps(id, queueType)) : undefined,
    };
  });

  // --- 1v1 ---
  const rivalsOrdered = ordered.filter((a) => a.id !== id);
  const ownCustoms = customsOf(id);
  const rivals: RivalComparable[] = rivalsOrdered.map((a) => {
    let wins = 0;
    let losses = 0;
    for (const c of ownCustoms) {
      const rivalTeam = c.side === "A" ? c.match.teamB : c.match.teamA;
      if (!rivalTeam.some((p) => p.accountId === a.id)) continue;
      if (c.won) wins++;
      else losses++;
    }
    return { ...comparableOf(a), customs: { wins, losses } };
  });
  const justAbove = ownIndex > 0 ? ordered[ownIndex - 1].id : null;
  const initialRivalId = rivals.some((r) => r.id === vsParam) ? vsParam! : (justAbove ?? rivals[0]?.id ?? null);

  const primary = primaryQueue(id);
  const data: ProfileViewData = {
    hero: {
      name: account.gameName,
      tag: account.tagLine,
      position,
      avatarUrl: avatarOf(id),
      splashUrl: topChampion ? championSplashUrl(topChampion) : undefined,
      inGame: account.inGame,
      rank: ownStats
        ? {
            label: tierLabel(ownStats.tier, ownStats.rank),
            color: tierColor,
            emblemUrl: tierEmblemUrl(ownStats.tier),
            leaguePoints: ownStats.leaguePoints,
            progress: APEX.has(ownStats.tier.toUpperCase()) ? 100 : Math.max(0, Math.min(100, ownStats.leaguePoints)),
          }
        : null,
      lpToday: ownStats?.delta,
      winrate: ownStats && ownGames > 0 ? `${Math.round((ownStats.wins / ownGames) * 100)}%` : "—",
      kda: ownKda === undefined ? "—" : ownKda.toFixed(1),
    },
    chart: {
      points: primary ? compressLpHistory(snaps(id, primary), monthAgo.getTime()) : [],
      rangeEndMs: nowMs,
      color: tierColor,
    },
    matches: {
      rows: matches,
      options: matchQueueOptions(path, search, cola),
      emptyText:
        cola === "todas" ? "Todavía no hay partidas guardadas de este jugador." : `No hay partidas de ${RANKED_QUEUES[cola].label} recientes.`,
    },
    analysis: {
      text: account.analysis?.text,
      whenLabel: account.analysis
        ? isSameLocalDay(account.analysis.generatedAt, now)
          ? "hoy"
          : formatRelativeTime(account.analysis.generatedAt)
        : null,
    },
    badges: badgesOf(id),
    compare: { self: comparableOf(account), rivals, initialRivalId },
  };

  return (
    <RankingShell slug={slug} access={access} path={path}>
      <ProfileView slug={slug} data={data} />
    </RankingShell>
  );
}
