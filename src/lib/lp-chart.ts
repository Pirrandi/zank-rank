// Pure geometry for the profile's "Historial de LP" chart. Client-safe (no Prisma, no env):
// the 7/30-day toggle recomputes it in the browser from server-provided points.
//
// Values are absolute ladder values (getLpScore: tierIndex*400 + divisionIndex*100 + LP).

import { RANKS, TIERS } from "./rank-order";
import { tierLabel } from "./tier-colors";

export type LpPoint = { t: number; v: number };
export type ChartGridLine = { y: number; label: string };
export type LpChartGeometry = { line: string; area: string; grid: ChartGridLine[] };

const WIDTH = 600;
const APEX_START = 7 * 400; // MASTER: no divisions from here on.

// Label of the division that starts at ladder value `v` (a multiple of 100).
function divisionLabel(v: number): string {
  const tierIdx = Math.min(TIERS.length - 1, Math.floor(v / 400));
  const tier = TIERS[tierIdx];
  const rank = RANKS[Math.floor((v % 400) / 100)] ?? "IV";
  return tierLabel(tier, rank);
}

// Division boundaries inside [lo, hi]. Below Master every 100 is a division start; from Master
// up LP is unbounded, so only the tier starts (Master, Grandmaster, Challenger) are meaningful.
function boundariesWithin(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let b = Math.ceil(lo / 100) * 100; b <= hi; b += 100) {
    if (b < APEX_START || b % 400 === 0) out.push(b);
  }
  return out;
}

export function buildLpChart(points: LpPoint[]): LpChartGeometry | null {
  if (points.length < 2) return null;
  const values = points.map((p) => p.v);
  const min = Math.min(...values) - 10;
  const max = Math.max(...values) + 10;
  const t0 = points[0].t;
  const span = Math.max(1, points[points.length - 1].t - t0);

  const x = (t: number) => ((t - t0) / span) * WIDTH;
  const y = (v: number) => 190 - ((v - min) / (max - min)) * 180;

  const coords = points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${WIDTH},200 L0,200 Z`;
  const grid = boundariesWithin(min, max).map((b) => ({ y: Number(y(b).toFixed(1)), label: divisionLabel(b) }));
  return { line, area, grid };
}
