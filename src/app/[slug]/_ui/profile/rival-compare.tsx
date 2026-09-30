"use client";

import { useState } from "react";
import { signed } from "../common/format";

export type Comparable = {
  id: string;
  name: string;
  iconUrl: string | undefined;
  /** Ladder value (getLpScore) of the primary queue; undefined when unranked. */
  ladder: number | undefined;
  rankLabel: string;
  lpToday: number | undefined;
  /** 0–100, season W/L. */
  winrate: number | undefined;
  kda: number | undefined;
  games: number;
  badges: number;
};

export type RivalComparable = Comparable & { customs: { wins: number; losses: number } };

type Metric = { label: string; a: number | undefined; b: number | undefined; fa: string; fb: string };

function metrics(self: Comparable, rival: Comparable): Metric[] {
  const pct = (v: number | undefined) => (v === undefined ? "—" : `${Math.round(v)}%`);
  const kda = (v: number | undefined) => (v === undefined ? "—" : v.toFixed(1));
  const lp = (v: number | undefined) => (v === undefined ? "—" : signed(v));
  return [
    { label: "Rango", a: self.ladder, b: rival.ladder, fa: self.rankLabel, fb: rival.rankLabel },
    { label: "LP hoy", a: self.lpToday, b: rival.lpToday, fa: lp(self.lpToday), fb: lp(rival.lpToday) },
    { label: "Winrate", a: self.winrate, b: rival.winrate, fa: pct(self.winrate), fb: pct(rival.winrate) },
    { label: "KDA", a: self.kda, b: rival.kda, fa: kda(self.kda), fb: kda(rival.kda) },
    { label: "Partidas", a: self.games, b: rival.games, fa: String(self.games), fb: String(rival.games) },
    { label: "Logros", a: self.badges, b: rival.badges, fa: String(self.badges), fb: String(rival.badges) },
  ];
}

// "a" | "b" | null (tie or nothing to compare). A missing value always loses to a real one.
function winnerOf(m: Metric): "a" | "b" | null {
  if (m.a === undefined && m.b === undefined) return null;
  if (m.b === undefined) return "a";
  if (m.a === undefined) return "b";
  if (m.a === m.b) return null;
  return m.a > m.b ? "a" : "b";
}

// Bar widths on a shared scale starting at min(0, a, b), so negative "LP hoy" still reads.
function widths(m: Metric): [number, number] {
  const a = m.a ?? 0;
  const b = m.b ?? 0;
  const floor = Math.min(0, a, b);
  const top = Math.max(a, b) - floor;
  if (top <= 0) return [0, 0];
  return [m.a === undefined ? 0 : ((a - floor) / top) * 100, m.b === undefined ? 0 : ((b - floor) / top) * 100];
}

export function RivalCompare({ self, rivals, initialRivalId }: { self: Comparable; rivals: RivalComparable[]; initialRivalId: string | null }) {
  const [rivalId, setRivalId] = useState(initialRivalId ?? rivals[0]?.id ?? null);
  const rival = rivals.find((r) => r.id === rivalId) ?? rivals[0];

  if (!rival) {
    return (
      <section className="zr-card zr-stack" style={{ gap: 10 }}>
        <h3 className="zr-label">Comparar 1v1</h3>
        <p className="zr-muted-text">No hay otros jugadores en este ranking para comparar.</p>
      </section>
    );
  }

  const rows = metrics(self, rival);
  const winners = rows.map(winnerOf);
  const selfWins = winners.filter((w) => w === "a").length;
  const rivalWins = winners.filter((w) => w === "b").length;
  const { wins, losses } = rival.customs;

  return (
    <section className="zr-card zr-stack" style={{ gap: 14 }}>
      <h3 className="zr-label">Comparar 1v1</h3>
      <div className="zr-rival-picker" role="radiogroup" aria-label="Elegí rival">
        {rivals.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={r.id === rival.id}
            className="zr-rival-btn"
            data-selected={r.id === rival.id}
            title={r.name}
            onClick={() => setRivalId(r.id)}
          >
            {r.iconUrl ? <img src={r.iconUrl} alt={r.name} width={38} height={38} /> : <span aria-hidden>{r.name.slice(0, 1)}</span>}
          </button>
        ))}
      </div>
      <div className="zr-cmp-names">
        <span className="zr-ellipsis">{self.name}</span>
        <span className="zr-ellipsis" style={{ color: "var(--zr-violet)", textAlign: "right" }}>
          {rival.name}
        </span>
      </div>
      <div className="zr-stack" style={{ gap: 12 }}>
        {rows.map((m, i) => {
          const w = winners[i];
          const [wa, wb] = widths(m);
          return (
            <div key={m.label} className="zr-stack" style={{ gap: 5 }}>
              <div className="zr-cmp-head">
                <span style={{ color: w === "a" ? "var(--zr-accent)" : w === "b" ? "#4a4658" : "var(--zr-text-2)" }}>{m.fa}</span>
                <span style={{ color: "var(--zr-faint)" }}>{m.label}</span>
                <span style={{ color: w === "b" ? "var(--zr-violet)" : w === "a" ? "#4a4658" : "var(--zr-text-2)", textAlign: "right" }}>{m.fb}</span>
              </div>
              <div className="zr-cmp-bars">
                <div className="zr-cmp-track" style={{ justifyContent: "flex-end" }}>
                  <div style={{ width: `${wa}%`, background: w === "b" ? "#4a4658" : "var(--zr-accent)" }} />
                </div>
                <div className="zr-cmp-track">
                  <div style={{ width: `${wb}%`, background: w === "a" ? "#4a4658" : "var(--zr-violet)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="zr-cmp-foot">
        {wins + losses > 0 ? `Personalizadas entre ellos: ${wins}–${losses}.` : "Nunca se cruzaron en una personalizada. ¿Qué esperan?"}{" "}
        {selfWins > rivalWins
          ? `${self.name} gana ${selfWins} de 6 categorías.`
          : rivalWins > selfWins
            ? `${rival.name} gana ${rivalWins} de 6 categorías. Duele.`
            : "Empate técnico."}
      </p>
    </section>
  );
}
