// Pure derivations for the player profile (hero stats, LP chart points, per-match LP delta,
// badges, 1v1 comparison). Everything here reads stored rows only — no Riot calls — so a
// value that can't be derived is returned as undefined rather than estimated.

import type { Match, MatchParticipation, RankSnapshot } from "@prisma/client";
import { divisionIndex, getLpScore } from "./rank-order";
import type { LpPoint } from "./lp-chart";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const QUEUE_ID_BY_TYPE: Record<string, number> = { RANKED_SOLO_5x5: 420, RANKED_FLEX_SR: 440 };

const RANKED_QUEUE_IDS = new Set(Object.values(QUEUE_ID_BY_TYPE));

export type ParticipationWithMatch = MatchParticipation & { match: Match };

// --- LP history ---

// Keeps only the snapshots where the ladder value changes (plus the first and last), which is
// all a line chart needs and shrinks thousands of poll snapshots to a handful of points.
export function compressLpHistory(snapshotsAsc: RankSnapshot[], sinceMs: number): LpPoint[] {
  const inRange = snapshotsAsc.filter((s) => s.capturedAt.getTime() >= sinceMs);
  const out: LpPoint[] = [];
  for (let i = 0; i < inRange.length; i++) {
    const v = getLpScore(inRange[i]);
    const isEdge = i === 0 || i === inRange.length - 1;
    if (isEdge || v !== out[out.length - 1]?.v) out.push({ t: inRange[i].capturedAt.getTime(), v });
  }
  return out;
}

// --- Per-match LP delta ---

function lastAtOrBefore(snapshotsAsc: RankSnapshot[], ms: number): RankSnapshot | undefined {
  let lo = 0;
  let hi = snapshotsAsc.length - 1;
  let found: RankSnapshot | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (snapshotsAsc[mid].capturedAt.getTime() <= ms) {
      found = snapshotsAsc[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

function firstAtOrAfter(snapshotsAsc: RankSnapshot[], ms: number): RankSnapshot | undefined {
  let lo = 0;
  let hi = snapshotsAsc.length - 1;
  let found: RankSnapshot | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (snapshotsAsc[mid].capturedAt.getTime() >= ms) {
      found = snapshotsAsc[mid];
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return found;
}

// LP change attributable to one ranked match: the snapshot right before the game vs the first
// one after it ended. Only trusted when the season W/L moved by exactly this one game in the
// right direction — otherwise another game (or a missed poll) is mixed in and we return
// undefined instead of guessing.
export function matchLpDelta(p: ParticipationWithMatch, queueSnapshotsAsc: RankSnapshot[]): number | undefined {
  const start = p.match.gameCreation.getTime();
  const end = start + p.match.gameDuration * 1000;
  const before = lastAtOrBefore(queueSnapshotsAsc, start);
  const after = firstAtOrAfter(queueSnapshotsAsc, end);
  if (!before || !after) return undefined;
  const gamesBetween = after.wins + after.losses - (before.wins + before.losses);
  const winsBetween = after.wins - before.wins;
  if (gamesBetween !== 1 || winsBetween !== (p.win ? 1 : 0)) return undefined;
  return getLpScore(after) - getLpScore(before);
}

// --- KDA ---

// Average of per-match (k+a)/max(1,d) over the given (recent) matches.
export function averageKda(parts: { kills: number; deaths: number; assists: number }[]): number | undefined {
  if (parts.length === 0) return undefined;
  const sum = parts.reduce((acc, p) => acc + (p.kills + p.assists) / Math.max(1, p.deaths), 0);
  return sum / parts.length;
}

// --- Badges ---

export type BadgeKey = "PK" | "4K" | "3K" | "RB" | "W5" | "UP" | "1v1" | "NF" | "L5";
export type Badge = { key: BadgeKey; name: string; description: string; unlocked: boolean };

function longestRun(chronological: { win: boolean }[], win: boolean): number {
  let best = 0;
  let run = 0;
  for (const m of chronological) {
    run = m.win === win ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function climbedDivision(snapshotsAsc: RankSnapshot[], sinceMs: number): boolean {
  let prev: RankSnapshot | undefined;
  for (const s of snapshotsAsc) {
    if (prev && s.capturedAt.getTime() >= sinceMs && divisionIndex(s) > divisionIndex(prev)) return true;
    prev = s;
  }
  return false;
}

export type BadgeInput = {
  /** Every stored participation of the player (any queue). */
  participations: ParticipationWithMatch[];
  /** Ranked snapshots per queue, ascending. */
  snapshotsAscByQueue: RankSnapshot[][];
  /** Custom-game versus results of the player, as match start times. */
  versusWinsAt: Date[];
  nowMs: number;
};

// The nine profile badges, from stored data only. Window: last 30 days, except "Ascenso"
// (this week). "Noctámbulo" uses the server's local clock (TZ), like the rest of the app's
// "today" logic.
export function computeBadges({ participations, snapshotsAscByQueue, versusWinsAt, nowMs }: BadgeInput): Badge[] {
  const since = nowMs - 30 * DAY_MS;
  const recent = participations
    .filter((p) => p.match.gameCreation.getTime() >= since)
    .sort((a, b) => a.match.gameCreation.getTime() - b.match.gameCreation.getTime());
  const weekAgo = nowMs - 7 * DAY_MS;

  return [
    { key: "PK", name: "Pentakill", description: "Un pentakill en ranked", unlocked: recent.some((p) => p.pentaKills > 0 && RANKED_QUEUE_IDS.has(p.match.queueId)) },
    { key: "4K", name: "Cuádruple", description: "Al menos un quadrakill", unlocked: recent.some((p) => p.quadraKills > 0) },
    { key: "3K", name: "Triple", description: "Al menos un triple", unlocked: recent.some((p) => p.tripleKills > 0) },
    { key: "RB", name: "Ladrón", description: "Robó Barón o Dragón", unlocked: recent.some((p) => p.epicSteals > 0) },
    { key: "W5", name: "En llamas", description: "5 victorias seguidas", unlocked: longestRun(recent, true) >= 5 },
    { key: "UP", name: "Ascenso", description: "Subió de división esta semana", unlocked: snapshotsAscByQueue.some((q) => climbedDivision(q, weekAgo)) },
    { key: "1v1", name: "Rey del 1v1", description: "Ganó una personalizada", unlocked: versusWinsAt.some((d) => d.getTime() >= since) },
    {
      key: "NF",
      name: "Noctámbulo",
      description: "Partida después de las 3 AM",
      unlocked: recent.some((p) => {
        const h = p.match.gameCreation.getHours();
        return h >= 3 && h <= 5;
      }),
    },
    { key: "L5", name: "Maldito", description: "5 derrotas seguidas", unlocked: longestRun(recent, false) >= 5 },
  ];
}
