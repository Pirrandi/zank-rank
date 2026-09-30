import Link from "next/link";
import { Avatar } from "../common/avatar";
import { signed, signedColor } from "../common/format";

export type RecentMatchRow = {
  matchId: string;
  win: boolean;
  championName: string;
  queueLabel: string;
  iconUrl: string;
  company: string[];
  kda: string;
  whenText: string;
  durationText: string;
  lpDelta: number | undefined;
};

export type MatchQueueOption = { key: string; label: string; href: string; active: boolean };

export function RecentMatchesCard({ matches, options, emptyText }: { matches: RecentMatchRow[]; options: MatchQueueOption[]; emptyText: string }) {
  return (
    <section className="zr-card zr-stack" style={{ gap: 6 }}>
      <div className="zr-card-head" style={{ marginBottom: 6 }}>
        <h3 className="zr-label">Últimas partidas</h3>
        <nav className="zr-seg" aria-label="Cola de las partidas">
          {options.map((o) => (
            <Link key={o.key} href={o.href} aria-current={o.active ? "page" : undefined} scroll={false}>
              {o.label}
            </Link>
          ))}
        </nav>
      </div>
      {matches.length === 0 ? (
        <p className="zr-muted-text">{emptyText}</p>
      ) : (
        matches.map((m) => (
          <div key={m.matchId} className="zr-match-row">
            <span className="zr-result-chip" data-win={m.win}>
              {m.win ? "V" : "D"}
            </span>
            <Avatar src={m.iconUrl} alt={m.championName} size={36} radius={10} />
            <div className="zr-match-main">
              <div className="zr-match-champ">
                {m.championName}
                <span className="zr-queue-tag">{m.queueLabel}</span>
              </div>
              <div className="zr-match-company">{m.company.length > 0 ? `con ${m.company.join(", ")}` : "solo"}</div>
            </div>
            <span className="zr-match-kda">{m.kda}</span>
            <span className="zr-match-when">
              {m.whenText} · {m.durationText}
            </span>
            <span className="zr-match-lp" style={{ color: signedColor(m.lpDelta) }}>
              {m.lpDelta === undefined ? "" : signed(m.lpDelta)}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
