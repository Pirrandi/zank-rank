"use client";

import { useEffect, useState } from "react";
import { championImage } from "./champion";
import { dict, type Lang } from "./i18n";
import { prefersReducedMotion } from "./reduced-motion";

type Tier = "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND";
type Division = "IV" | "III" | "II" | "I";

type Player = {
  name: string;
  champion: string;
  tier: Tier;
  div: Division;
  lp: number;
  gained: number;
  streak: string;
  inGame: boolean;
};

type Flash = { name: string; delta: number; key: number };

const TIER_ORDER: Tier[] = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"];
const DIV_ORDER: Division[] = ["IV", "III", "II", "I"];

const TIER_INFO: Partial<Record<Tier, { color: string; emblem: string }>> = {
  BRONZE: { color: "#c98a4b", emblem: "bronze" },
  SILVER: { color: "#c7cdd6", emblem: "silver" },
  GOLD: { color: "#e6b53a", emblem: "gold" },
  PLATINUM: { color: "#4dd9c0", emblem: "platinum" },
  EMERALD: { color: "#34d399", emblem: "emerald" },
};

const TOP_COLORS = ["#ffd447", "#c7cdd6", "#c98a4b"];
const TICK_MS = 2600;

// Ranking de DEMO para el hero: es marketing, no datos en vivo. El primer render (SSR) es el
// seed ordenado; la simulación arranca recién en el efecto, así no hay hydration mismatch.
const SEED: Player[] = [
  { name: "despertada", champion: "Lux", tier: "EMERALD", div: "IV", lp: 20, gained: -14, streak: "WLWLL", inGame: false },
  { name: "smOKe", champion: "Kayn", tier: "PLATINUM", div: "II", lp: 64, gained: 35, streak: "LWWWW", inGame: true },
  { name: "ChuchoMid", champion: "Ahri", tier: "PLATINUM", div: "IV", lp: 71, gained: 12, streak: "WLWWL", inGame: false },
  { name: "Pirrandi", champion: "Jhin", tier: "GOLD", div: "I", lp: 88, gained: 22, streak: "WWWLW", inGame: true },
  { name: "NoFlash4U", champion: "Zed", tier: "SILVER", div: "II", lp: 40, gained: -41, streak: "LLLLL", inGame: false },
];

function rankValue(p: Player): number {
  return TIER_ORDER.indexOf(p.tier) * 400 + DIV_ORDER.indexOf(p.div) * 100 + p.lp;
}

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

function deltaColor(n: number): string {
  if (n > 0) return "var(--color-win)";
  if (n < 0) return "var(--color-loss)";
  return "var(--color-text-dim)";
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function playGame(players: Player[], index: number, win: boolean, delta: number): Player[] {
  return players.map((p, i) =>
    i === index
      ? {
          ...p,
          lp: Math.min(99, Math.max(0, p.lp + delta)),
          gained: p.gained + delta,
          streak: (p.streak + (win ? "W" : "L")).slice(-5),
        }
      : p,
  );
}

function LeaderboardRow({
  player,
  pos,
  flash,
  lang,
}: {
  player: Player;
  pos: number;
  flash: Flash | null;
  lang: Lang;
}) {
  const t = dict[lang];
  const top = TOP_COLORS[pos - 1];
  const tier = TIER_INFO[player.tier];
  const tierLabel = t.tiers[player.tier as keyof typeof t.tiers] ?? player.tier;
  const fxColor = flash && flash.delta > 0 ? "#4ade80" : "#ff5470";

  return (
    <div className="lp-row" style={{ borderColor: top ? `${top}40` : "#24212f" }}>
      {flash && (
        <>
          <div
            key={`glow-${flash.key}`}
            className="lp-row-glow"
            style={{ borderColor: fxColor, boxShadow: `0 0 24px ${fxColor}55` }}
            aria-hidden="true"
          />
          <span key={`float-${flash.key}`} className="lp-row-float" style={{ color: fxColor }} aria-hidden="true">
            {signed(flash.delta)} LP
          </span>
        </>
      )}
      <span className="lp-row-pos" style={{ color: top ?? "#6c6880" }}>
        {pos}
      </span>
      <div className="lp-row-avatar">
        <img src={championImage(player.champion)} alt="" width={38} height={38} />
        {player.inGame && <span className="lp-row-ingame" aria-label={t.leaderboardDemo.inGameAria} />}
      </div>
      <div className="lp-row-main">
        <div className="lp-row-name">{player.name}</div>
        <div className="lp-row-tier" style={{ color: tier?.color }}>
          {tier && <img src={`/emblems/${tier.emblem}.png`} alt="" width={18} height={18} />}
          <span>
            {tierLabel} {player.div} · {player.lp} LP
          </span>
        </div>
      </div>
      <div className="lp-row-dots" aria-hidden="true">
        {player.streak.split("").map((result, i) => (
          <span key={i} className={result === "W" ? "lp-dot-win" : "lp-dot-loss"} />
        ))}
      </div>
      <span className="lp-row-delta" style={{ color: deltaColor(player.gained) }}>
        {signed(player.gained)}
      </span>
    </div>
  );
}

export function LeaderboardDemo({ lang }: { lang: Lang }) {
  const t = dict[lang].leaderboardDemo;
  const [players, setPlayers] = useState(SEED);
  const [flash, setFlash] = useState<Flash | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      const index = Math.floor(Math.random() * SEED.length);
      const win = Math.random() < 0.55;
      const delta = win ? randomInt(14, 23) : -randomInt(12, 21);
      setPlayers((current) => playGame(current, index, win, delta));
      setFlash({ name: SEED[index].name, delta, key: Date.now() });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const sorted = [...players].sort((a, b) => rankValue(b) - rankValue(a));

  return (
    <div className="lp-demo">
      <div className="lp-toast">
        <img src={championImage("Jhin")} alt="" width={36} height={36} />
        <div style={{ minWidth: 0 }}>
          <div className="lp-toast-label">{t.toastLabel}</div>
          <div className="lp-toast-text">{t.toastText}</div>
        </div>
      </div>
      <div className="lp-board">
        <div className="lp-board-head">
          <div className="lp-board-title">{t.boardTitle}</div>
          <div className="lp-live">
            <span className="lp-pulse-dot lp-pulse-dot-sm" />
            {t.live}
          </div>
        </div>
        {sorted.map((player, i) => (
          <LeaderboardRow
            key={player.name}
            lang={lang}
            player={player}
            pos={i + 1}
            flash={flash?.name === player.name ? flash : null}
          />
        ))}
      </div>
    </div>
  );
}
