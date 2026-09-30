import Link from "next/link";
import { Avatar } from "../common/avatar";

export type VersusPlayer = { accountId: string; name: string; championName: string; iconUrl: string };
export type VersusMatch = {
  matchId: string;
  format: string;
  whenText: string;
  teamA: VersusPlayer[];
  teamB: VersusPlayer[];
  teamAWon: boolean;
};

function TeamColumn({ slug, players, won, mirrored }: { slug: string; players: VersusPlayer[]; won: boolean; mirrored: boolean }) {
  return (
    <div className="zr-vs-team" data-mirrored={mirrored} style={{ opacity: won ? 1 : 0.55 }}>
      {players.map((p) => (
        <Link key={p.accountId} href={`/${slug}/players/${p.accountId}`} className="zr-vs-player" title={`${p.name} · ${p.championName}`}>
          <Avatar src={p.iconUrl} alt={p.championName} size={34} radius={10} />
          <span className="zr-ellipsis">{p.name}</span>
        </Link>
      ))}
      <span className="zr-vs-result" data-won={won}>
        {won ? "VICTORIA" : "DERROTA"}
      </span>
    </div>
  );
}

export function CustomMatchCard({ slug, match }: { slug: string; match: VersusMatch }) {
  return (
    <article className="zr-vs-card">
      <div className="zr-vs-top">
        <span className="zr-vs-format">{match.format}</span>
        <span>{match.whenText}</span>
      </div>
      <div className="zr-vs-grid">
        <TeamColumn slug={slug} players={match.teamA} won={match.teamAWon} mirrored={false} />
        <span className="zr-vs-sep">vs</span>
        <TeamColumn slug={slug} players={match.teamB} won={!match.teamAWon} mirrored />
      </div>
    </article>
  );
}
