import Link from "next/link";
import { Avatar } from "../common/avatar";
import { LiveTimer } from "./live-timer";
import { BetControls } from "./bet-controls";

export type LiveBetState =
  | { kind: "none" }
  | { kind: "closed" }
  | { kind: "login"; loginHref: string }
  | { kind: "blocked"; reason: string }
  | { kind: "placed"; amount: number; guess: boolean; payout: number }
  | { kind: "open"; roundId: string };

export type LiveCardData = {
  accountId: string;
  name: string;
  championName: string;
  iconUrl: string | undefined;
  splashUrl: string | undefined;
  queueLabel: string;
  startedAtMs: number | null;
  withNames: string[];
  vsNames: string[];
  bet: LiveBetState;
};

function companions(card: LiveCardData): string {
  const parts: string[] = [];
  if (card.withNames.length > 0) parts.push(`con ${card.withNames.join(", ")}`);
  if (card.vsNames.length > 0) parts.push(`vs ${card.vsNames.join(", ")}`);
  return parts.length > 0 ? parts.join(" · ") : "solo";
}

function BetBlock({ slug, bet }: { slug: string; bet: LiveBetState }) {
  switch (bet.kind) {
    case "none":
      return null;
    case "closed":
      return <p className="zr-bet-note">Apuestas cerradas</p>;
    case "login":
      return (
        <a href={bet.loginHref} className="zr-bet-login">
          Entrá con Discord para apostar
        </a>
      );
    case "blocked":
      return <p className="zr-bet-note">{bet.reason}</p>;
    case "placed":
      return (
        <p className="zr-bet-placed">
          Apostaste {bet.amount} ZC a que <strong>{bet.guess ? "GANA" : "PIERDE"}</strong> · paga {bet.payout}
        </p>
      );
    case "open":
      return <BetControls slug={slug} roundId={bet.roundId} />;
  }
}

export function LiveCard({ slug, card, renderedAtMs }: { slug: string; card: LiveCardData; renderedAtMs: number }) {
  return (
    <article className="zr-live-card">
      <div className="zr-live-top">
        {card.splashUrl && <img src={card.splashUrl} alt="" className="zr-live-splash" />}
        <div className="zr-live-shade" aria-hidden />
        <span className="zr-live-pill">
          <span className="zr-dot zr-dot-pulse" aria-hidden />
          EN PARTIDA · {card.startedAtMs ? <LiveTimer startedAtMs={card.startedAtMs} renderedAtMs={renderedAtMs} /> : "cargando"}
        </span>
        <span className="zr-live-queue">{card.queueLabel}</span>
      </div>
      <div className="zr-live-body">
        <Link href={`/${slug}/players/${card.accountId}`} className="zr-live-who">
          <Avatar src={card.iconUrl} alt={card.championName} size={54} radius={16} className="zr-live-champ" />
          <span className="zr-stack" style={{ minWidth: 0 }}>
            <span className="zr-live-name zr-ellipsis">{card.name}</span>
            <span className="zr-live-sub">
              {card.championName} · {companions(card)}
            </span>
          </span>
        </Link>
        <BetBlock slug={slug} bet={card.bet} />
      </div>
    </article>
  );
}
