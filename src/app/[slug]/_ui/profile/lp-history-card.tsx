"use client";

import { useState } from "react";
import { buildLpChart, type LpPoint } from "@/lib/lp-chart";

const DAY_MS = 24 * 60 * 60 * 1000;

// Chart points arrive from the server already limited to 30 days; the 7-day view filters
// against the server's `rangeEndMs` (never the browser clock) so SSR and hydration agree.
export function LpHistoryCard({ points, rangeEndMs, color }: { points: LpPoint[]; rangeEndMs: number; color: string }) {
  const [days, setDays] = useState<7 | 30>(7);
  const visible = days === 30 ? points : points.filter((p) => p.t >= rangeEndMs - 7 * DAY_MS);
  const chart = buildLpChart(visible);

  return (
    <section className="zr-card zr-stack" style={{ gap: 14 }}>
      <div className="zr-card-head">
        <h3 className="zr-label">Historial de LP</h3>
        <div className="zr-seg" role="group" aria-label="Rango del historial">
          {([7, 30] as const).map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} días
            </button>
          ))}
        </div>
      </div>
      {chart ? (
        <>
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="zr-chart" role="img" aria-label={`Historial de LP de los últimos ${days} días`}>
            {chart.grid.map((g) => (
              <line key={g.label + g.y} x1={0} x2={600} y1={g.y} y2={g.y} stroke="#2b2839" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={chart.area} fill={color} opacity={0.12} />
            <path d={chart.line} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {chart.grid.length > 0 && (
            <div className="zr-chart-legend">
              {chart.grid.map((g) => (
                <span key={g.label + g.y}>— {g.label}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="zr-muted-text">Sin cambios de LP registrados en los últimos {days} días.</p>
      )}
    </section>
  );
}
