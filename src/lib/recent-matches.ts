import { prisma } from "./prisma";
import { RANKED_QUEUES, type RankedQueueParam } from "./queues";

export type RecentMatch = {
  key: string;
  accountId: string;
  gameName: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  gameCreation: Date;
  durationMinutes: number;
};

// Latest tracked-player games of one ranked queue, newest first. One row per player, so a duo
// that played together shows up as two entries.
export async function getRecentMatches(rankingId: string, queueParam: RankedQueueParam, limit = 6): Promise<RecentMatch[]> {
  const rows = await prisma.matchParticipation.findMany({
    where: { rankingId, match: { queueId: RANKED_QUEUES[queueParam].queueId } },
    orderBy: { match: { gameCreation: "desc" } },
    take: limit,
    select: {
      id: true,
      accountId: true,
      championName: true,
      kills: true,
      deaths: true,
      assists: true,
      win: true,
      account: { select: { gameName: true } },
      match: { select: { gameCreation: true, gameDuration: true } },
    },
  });

  return rows.map((r) => ({
    key: r.id,
    accountId: r.accountId,
    gameName: r.account.gameName,
    championName: r.championName,
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    win: r.win,
    gameCreation: r.match.gameCreation,
    durationMinutes: Math.round(r.match.gameDuration / 60),
  }));
}
