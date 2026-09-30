export type Achievement = { key: string; label: string; achieved: boolean };

export type AchievementInput = {
  participations: { win: boolean; pentaKills: number; tripleKills: number; epicSteals: number }[];
  soloMilestonesCount: number;
  currentWinStreak: number;
  versusWins: number;
};

// Judgment call: the handoff's "logros" grid has no backing model or defined criteria, so
// this is a derived, opinionated set computed from data that already exists — not persisted.
export function computeAchievements({ participations, soloMilestonesCount, currentWinStreak, versusWins }: AchievementInput): Achievement[] {
  const totalGames = participations.length;
  return [
    { key: "first-win", label: "Primera Victoria", achieved: participations.some((p) => p.win) },
    { key: "streak-3", label: "Racha x3", achieved: currentWinStreak >= 3 },
    { key: "streak-5", label: "Racha x5", achieved: currentWinStreak >= 5 },
    { key: "streak-10", label: "Racha x10", achieved: currentWinStreak >= 10 },
    { key: "penta", label: "Pentakill", achieved: participations.some((p) => p.pentaKills > 0) },
    { key: "triple", label: "Triple Kill", achieved: participations.some((p) => p.tripleKills > 0) },
    { key: "steal", label: "Robo Épico", achieved: participations.some((p) => p.epicSteals > 0) },
    { key: "tier-up", label: "Subió de Tier", achieved: soloMilestonesCount > 1 },
    { key: "versus-win", label: "Ganó un Versus", achieved: versusWins > 0 },
    { key: "veteran", label: "100 Partidas", achieved: totalGames >= 100 },
  ];
}

export function computeKda(participations: { kills: number; deaths: number; assists: number }[]): number {
  if (participations.length === 0) return 0;
  const kills = participations.reduce((s, p) => s + p.kills, 0);
  const deaths = participations.reduce((s, p) => s + p.deaths, 0);
  const assists = participations.reduce((s, p) => s + p.assists, 0);
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}
