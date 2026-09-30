import { prisma } from "./prisma";
import { lossStreak, winStreak, lpDropOverWindow } from "./derive";
import { getWindowSnapshots } from "./snapshot-summary";
import { RANKED_QUEUES, type RankedQueueParam } from "./queues";

const DAY_MS = 24 * 60 * 60 * 1000;
const WALL_LOOKBACK_MS = 14 * DAY_MS;
const DUO_LOOKBACK_MS = 7 * DAY_MS;

// Muros de fama/vergüenza only consider matches from the last 2 weeks — an old penta or a
// months-stale death record shouldn't win forever. Computed fresh per call, not module-level,
// so it doesn't go stale across a long-running poll/dev-server process.
function wallCutoff(): Date {
  return new Date(Date.now() - WALL_LOOKBACK_MS);
}

// Best duo of the week only looks at the last 7 rolling days — its own, shorter window than
// the 2-week walls, computed fresh per call for the same reason as wallCutoff().
function duoCutoff(): Date {
  return new Date(Date.now() - DUO_LOOKBACK_MS);
}

// Rounds the *real* elapsed time between the reference and latest snapshot, instead of
// hardcoding "24h": an account with only a few hours of history has its earliest snapshot as
// the reference (lpDropOverWindow falls back to whatever's available inside the window), so
// labeling that as a flat "24h" would overstate how far back the comparison actually reaches.
function windowHoursBetween(referenceAt: Date, latestAt: Date): number {
  return Math.max(1, Math.round((latestAt.getTime() - referenceAt.getTime()) / (60 * 60 * 1000)));
}

export type ShameStreak = { id: string; gameName: string; tagLine: string; streak: number; queueParam: RankedQueueParam; queueLabel: string };
export type FameStreak = { id: string; gameName: string; tagLine: string; streak: number; queueParam: RankedQueueParam; queueLabel: string };
export type LpMove = { id: string; gameName: string; tagLine: string; amount: number; windowHours: number; queueParam: RankedQueueParam; queueLabel: string };

// Every wall record is scoped to one ranked queue: its matches (Match.queueId) and its
// snapshots (RankSnapshot.queueType), never both queues mixed.
export async function getShameHighlights(
  rankingId: string,
  queueParam: RankedQueueParam
): Promise<{ streaks: ShameStreak[]; winStreaks: FameStreak[]; drops: LpMove[]; gains: LpMove[] }> {
  const queue = RANKED_QUEUES[queueParam];
  const accounts = await prisma.trackedAccount.findMany({
    where: { rankingId },
    include: {
      participations: { where: { match: { queueId: queue.queueId, gameCreation: { gte: wallCutoff() } } }, include: { match: true }, orderBy: { match: { gameCreation: "desc" } } },
    },
  });

  // Only the latest snapshot and the earliest one inside the window are needed per account.
  const windows = await Promise.all(accounts.map((a) => getWindowSnapshots(a.id, queue.type, DAY_MS)));

  const streaks: ShameStreak[] = [];
  const winStreaks: FameStreak[] = [];
  const drops: LpMove[] = [];
  const gains: LpMove[] = [];

  for (const [index, account] of accounts.entries()) {
    const loseStreakCount = lossStreak(account.participations);
    if (loseStreakCount >= 2) {
      streaks.push({ id: account.id, gameName: account.gameName, tagLine: account.tagLine, streak: loseStreakCount, queueParam: queue.param, queueLabel: queue.label });
    }
    const winStreakCount = winStreak(account.participations);
    if (winStreakCount >= 2) {
      winStreaks.push({ id: account.id, gameName: account.gameName, tagLine: account.tagLine, streak: winStreakCount, queueParam: queue.param, queueLabel: queue.label });
    }

    const move = lpDropOverWindow(windows[index], DAY_MS);
    if (move && move.delta !== 0) {
      const entry: LpMove = {
        id: account.id,
        gameName: account.gameName,
        tagLine: account.tagLine,
        amount: Math.abs(move.delta),
        windowHours: windowHoursBetween(move.reference.capturedAt, move.latest.capturedAt),
        queueParam: queue.param,
        queueLabel: queue.label,
      };
      if (move.delta < 0) drops.push(entry);
      else gains.push(entry);
    }
  }

  streaks.sort((a, b) => b.streak - a.streak);
  winStreaks.sort((a, b) => b.streak - a.streak);
  drops.sort((a, b) => b.amount - a.amount);
  gains.sort((a, b) => b.amount - a.amount);
  return { streaks, winStreaks, drops, gains };
}

export type WorstGame = { id: string; gameName: string; tagLine: string; deaths: number; kills: number; assists: number; championName: string; queueParam: RankedQueueParam; queueLabel: string };

// Most deaths in a single recorded game for this ranking/queue — a genuine data point (unlike
// a fabricated "worst KDA" score, which would need an arbitrary weighting to rank low-kill,
// low-death games against feed-fests).
export async function getWorstGame(rankingId: string, queueParam: RankedQueueParam): Promise<WorstGame | undefined> {
  const queue = RANKED_QUEUES[queueParam];
  const row = await prisma.matchParticipation.findFirst({
    where: { rankingId, match: { queueId: queue.queueId, gameCreation: { gte: wallCutoff() } }, deaths: { gt: 0 } },
    include: { account: true },
    orderBy: [{ deaths: "desc" }, { match: { gameCreation: "desc" } }],
  });
  if (!row) return undefined;
  return {
    id: row.accountId,
    gameName: row.account.gameName,
    tagLine: row.account.tagLine,
    deaths: row.deaths,
    kills: row.kills,
    assists: row.assists,
    championName: row.championName,
    queueParam: queue.param,
    queueLabel: queue.label,
  };
}

export type HotStreakPlayer = { id: string; gameName: string; tagLine: string; tier: string; rank: string; leaguePoints: number };

// Riot's own "on a heater" flag (RankedEntry.hotStreak), already stored on every RankSnapshot
// but never surfaced anywhere in the app until now.
export async function getHotStreakPlayers(rankingId: string, queueParam: RankedQueueParam): Promise<HotStreakPlayer[]> {
  const queue = RANKED_QUEUES[queueParam];
  const accounts = await prisma.trackedAccount.findMany({
    where: { rankingId },
    include: { snapshots: { where: { queueType: queue.type }, orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  return accounts
    .map((a) => ({ account: a, latest: a.snapshots[0] }))
    .filter((x): x is { account: (typeof accounts)[number]; latest: NonNullable<(typeof accounts)[number]["snapshots"][0]> } => Boolean(x.latest?.hotStreak))
    .map(({ account, latest }) => ({
      id: account.id,
      gameName: account.gameName,
      tagLine: account.tagLine,
      tier: latest.tier,
      rank: latest.rank,
      leaguePoints: latest.leaguePoints,
    }))
    .sort((a, b) => b.leaguePoints - a.leaguePoints);
}

export type FameHighlight = {
  id: string;
  gameName: string;
  tagLine: string;
  championName: string;
  value: number;
};

export async function getBiggestPentaKill(rankingId: string, queueParam: RankedQueueParam): Promise<FameHighlight | undefined> {
  const row = await prisma.matchParticipation.findFirst({
    where: { pentaKills: { gt: 0 }, rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId, gameCreation: { gte: wallCutoff() } } },
    include: { account: true },
    orderBy: { match: { gameCreation: "desc" } },
  });
  if (!row) return undefined;
  return {
    id: row.accountId,
    gameName: row.account.gameName,
    tagLine: row.account.tagLine,
    championName: row.championName,
    value: row.pentaKills,
  };
}

export async function getTopTripleKills(rankingId: string, queueParam: RankedQueueParam): Promise<FameHighlight | undefined> {
  const grouped = await prisma.matchParticipation.groupBy({
    by: ["accountId"],
    where: { rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId, gameCreation: { gte: wallCutoff() } } },
    _sum: { tripleKills: true },
    orderBy: { _sum: { tripleKills: "desc" } },
    take: 1,
  });
  const top = grouped[0];
  if (!top || !top._sum.tripleKills || top._sum.tripleKills === 0) return undefined;

  const account = await prisma.trackedAccount.findUnique({ where: { id: top.accountId } });
  if (!account) return undefined;

  const bestMatch = await prisma.matchParticipation.findFirst({
    where: { accountId: top.accountId, tripleKills: { gt: 0 }, rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId, gameCreation: { gte: wallCutoff() } } },
    orderBy: { tripleKills: "desc" },
  });

  return {
    id: account.id,
    gameName: account.gameName,
    tagLine: account.tagLine,
    championName: bestMatch?.championName ?? "",
    value: top._sum.tripleKills,
  };
}

export async function getTopQuadraKills(rankingId: string, queueParam: RankedQueueParam): Promise<FameHighlight | undefined> {
  const grouped = await prisma.matchParticipation.groupBy({
    by: ["accountId"],
    where: { rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId, gameCreation: { gte: wallCutoff() } } },
    _sum: { quadraKills: true },
    orderBy: { _sum: { quadraKills: "desc" } },
    take: 1,
  });
  const top = grouped[0];
  if (!top || !top._sum.quadraKills || top._sum.quadraKills === 0) return undefined;

  const account = await prisma.trackedAccount.findUnique({ where: { id: top.accountId } });
  if (!account) return undefined;

  const bestMatch = await prisma.matchParticipation.findFirst({
    where: { accountId: top.accountId, quadraKills: { gt: 0 }, rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId, gameCreation: { gte: wallCutoff() } } },
    orderBy: { quadraKills: "desc" },
  });

  return {
    id: account.id,
    gameName: account.gameName,
    tagLine: account.tagLine,
    championName: bestMatch?.championName ?? "",
    value: top._sum.quadraKills,
  };
}

export async function getTopEpicSteals(rankingId: string, queueParam: RankedQueueParam): Promise<FameHighlight | undefined> {
  const grouped = await prisma.matchParticipation.groupBy({
    by: ["accountId"],
    where: { rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId, gameCreation: { gte: wallCutoff() } } },
    _sum: { epicSteals: true },
    orderBy: { _sum: { epicSteals: "desc" } },
    take: 1,
  });
  const top = grouped[0];
  if (!top || !top._sum.epicSteals || top._sum.epicSteals === 0) return undefined;

  const account = await prisma.trackedAccount.findUnique({ where: { id: top.accountId } });
  if (!account) return undefined;

  const bestMatch = await prisma.matchParticipation.findFirst({
    where: { accountId: top.accountId, epicSteals: { gt: 0 }, rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId, gameCreation: { gte: wallCutoff() } } },
    orderBy: { epicSteals: "desc" },
  });

  return {
    id: account.id,
    gameName: account.gameName,
    tagLine: account.tagLine,
    championName: bestMatch?.championName ?? "",
    value: top._sum.epicSteals,
  };
}

export type DuoOfWeek = {
  a: { id: string; gameName: string; tagLine: string };
  b: { id: string; gameName: string; tagLine: string };
  wins: number;
  queueParam: RankedQueueParam;
  queueLabel: string;
};

type DuoWinRow = { matchId: string; teamId: number; accountId: string; account: { gameName: string; tagLine: string } };

// Pair of tracked accounts with the most co-wins (same match, same winning team) in the last 7
// rolling days. Every winning team of every match is its own bucket — any two tracked accounts
// in that bucket count as a duo win for that game, so a 3+-way stack still contributes to each
// pair within it.
export async function getBestDuoOfWeek(rankingId: string, queueParam: RankedQueueParam): Promise<DuoOfWeek | undefined> {
  const queue = RANKED_QUEUES[queueParam];
  const winRows = await prisma.matchParticipation.findMany({
    where: { rankingId, win: true, match: { queueId: queue.queueId, gameCreation: { gte: duoCutoff() } } },
    select: { matchId: true, teamId: true, accountId: true, account: { select: { gameName: true, tagLine: true } } },
  });

  const byWinningTeam = new Map<string, DuoWinRow[]>();
  for (const row of winRows) {
    const key = `${row.matchId}_${row.teamId}`;
    const group = byWinningTeam.get(key);
    if (group) group.push(row);
    else byWinningTeam.set(key, [row]);
  }

  const pairWins = new Map<string, number>();
  const pairRows = new Map<string, [DuoWinRow, DuoWinRow]>();

  for (const group of byWinningTeam.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [first, second] =
          group[i].accountId < group[j].accountId ? [group[i], group[j]] : [group[j], group[i]];
        const key = `${first.accountId}|${second.accountId}`;
        pairWins.set(key, (pairWins.get(key) ?? 0) + 1);
        if (!pairRows.has(key)) pairRows.set(key, [first, second]);
      }
    }
  }

  let bestKey: string | undefined;
  let bestWins = 0;
  for (const [key, wins] of pairWins) {
    if (wins > bestWins) {
      bestWins = wins;
      bestKey = key;
    }
  }
  if (!bestKey) return undefined;

  const [first, second] = pairRows.get(bestKey)!;
  return {
    a: { id: first.accountId, gameName: first.account.gameName, tagLine: first.account.tagLine },
    b: { id: second.accountId, gameName: second.account.gameName, tagLine: second.account.tagLine },
    wins: bestWins,
    queueParam: queue.param,
    queueLabel: queue.label,
  };
}
