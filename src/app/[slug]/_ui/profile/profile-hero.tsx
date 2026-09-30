import { Avatar } from "../common/avatar";
import { signed, signedColor } from "../common/format";

export type HeroRank = {
  label: string;
  color: string;
  emblemUrl: string | undefined;
  leaguePoints: number;
  /** 0–100 fill of the division bar (100 for apex tiers). */
  progress: number;
} | null;

export type HeroData = {
  name: string;
  tag: string;
  position: number | null;
  avatarUrl: string | undefined;
  splashUrl: string | undefined;
  inGame: boolean;
  rank: HeroRank;
  lpToday: number | undefined;
  winrate: string;
  kda: string;
};

export function ProfileHero({ hero }: { hero: HeroData }) {
  const ring = hero.rank?.color ?? "var(--zr-border)";
  return (
    <section className="zr-hero">
      {hero.splashUrl && <img src={hero.splashUrl} alt="" className="zr-hero-bg" />}
      <div className="zr-hero-shade" aria-hidden />
      <div className="zr-hero-content">
        <div className="zr-hero-avatar">
          <Avatar src={hero.avatarUrl} alt={hero.name} size={104} radius={30} style={{ border: `3px solid ${ring}` }} />
          {hero.inGame && <span className="zr-dot zr-dot-pulse zr-hero-live" title="En partida" />}
        </div>

        <div className="zr-hero-info">
          <div className="zr-hero-meta">{hero.position !== null ? `#${hero.position} del grupo` : "Sin posición en el grupo"}</div>
          <h1 className="zr-hero-name">
            {hero.name}
            <span className="zr-hero-tag"> #{hero.tag}</span>
          </h1>
          <div className="zr-hero-rank">
            {hero.rank?.emblemUrl && <img src={hero.rank.emblemUrl} alt="" width={46} height={46} className="zr-hero-emblem" />}
            <div className="zr-hero-rankblock">
              <div className="zr-hero-rankline" style={{ color: ring }}>
                <span>{hero.rank?.label ?? "Sin rango"}</span>
                {hero.rank && <span className="zr-mono zr-hero-lp">{hero.rank.leaguePoints} LP</span>}
              </div>
              <div className="zr-bar">
                <div className="zr-bar-fill" style={{ width: `${hero.rank?.progress ?? 0}%`, background: ring }} />
              </div>
            </div>
          </div>
        </div>

        <dl className="zr-hero-stats">
          <div>
            <dt>LP hoy</dt>
            <dd style={{ color: signedColor(hero.lpToday) }}>{hero.lpToday === undefined ? "—" : signed(hero.lpToday)}</dd>
          </div>
          <div>
            <dt>Winrate</dt>
            <dd>{hero.winrate}</dd>
          </div>
          <div>
            <dt>KDA</dt>
            <dd>{hero.kda}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
