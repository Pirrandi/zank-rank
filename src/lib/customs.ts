import { prisma } from "./prisma";

const CUSTOM_GAME_QUEUE_ID = 0;

export type CustomMatchup = {
  matchId: string;
  gameCreation: Date;
  label: string;
  teamA: { accountId: string; gameName: string; tagLine: string; championName: string; championId: number; win: boolean }[];
  teamB: { accountId: string; gameName: string; tagLine: string; championName: string; championId: number; win: boolean }[];
};

export async function getCustomMatchups(rankingId: string): Promise<CustomMatchup[]> {
  // Match is global (design D9): filter through the tenant-scoped MatchParticipation relation
  // instead of a (now-dropped) Match.rankingId column, and only include this ranking's own
  // participations — a shared game can otherwise carry rows from another ranking too.
  const matches = await prisma.match.findMany({
    where: { queueId: CUSTOM_GAME_QUEUE_ID, participations: { some: { rankingId } } },
    include: { participations: { where: { rankingId }, include: { account: true } } },
    orderBy: { gameCreation: "desc" },
  });

  const matchups: CustomMatchup[] = [];

  for (const match of matches) {
    const teamIds = [...new Set(match.participations.map((p) => p.teamId))];
    if (teamIds.length < 2) continue;

    const [teamAId, teamBId] = teamIds;
    const teamA = match.participations.filter((p) => p.teamId === teamAId);
    const teamB = match.participations.filter((p) => p.teamId === teamBId);
    if (teamA.length === 0 || teamB.length === 0) continue;

    matchups.push({
      matchId: match.id,
      gameCreation: match.gameCreation,
      label: `${teamA.length}v${teamB.length}`,
      teamA: teamA.map((p) => ({
        accountId: p.accountId,
        gameName: p.account.gameName,
        tagLine: p.account.tagLine,
        championName: p.championName,
        championId: p.championId,
        win: p.win,
      })),
      teamB: teamB.map((p) => ({
        accountId: p.accountId,
        gameName: p.account.gameName,
        tagLine: p.account.tagLine,
        championName: p.championName,
        championId: p.championId,
        win: p.win,
      })),
    });
  }

  return matchups;
}

export type VersusKing = {
  accountId: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  wins: number;
  losses: number;
};

export async function getVersusKings(rankingId: string): Promise<VersusKing[]> {
  const participations = await prisma.matchParticipation.findMany({
    where: { rankingId, match: { queueId: CUSTOM_GAME_QUEUE_ID } },
    include: { account: true },
  });

  const byAccount = new Map<string, VersusKing>();
  for (const p of participations) {
    let entry = byAccount.get(p.accountId);
    if (!entry) {
      entry = {
        accountId: p.accountId,
        gameName: p.account.gameName,
        tagLine: p.account.tagLine,
        profileIconId: p.account.profileIconId,
        wins: 0,
        losses: 0,
      };
      byAccount.set(p.accountId, entry);
    }
    if (p.win) entry.wins++;
    else entry.losses++;
  }

  // Most wins first; on a tie, fewer losses ranks higher.
  return Array.from(byAccount.values())
    .filter((k) => k.wins + k.losses > 0)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}
