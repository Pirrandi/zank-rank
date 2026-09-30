import { championImage } from "./champion";
import { DiscordEmbedMock } from "./discord-embed-mock";
import { dict, type Lang } from "./i18n";
import { MatchTimer } from "./match-timer";
import { RotatingRoast } from "./rotating-roast";

const LP_PATH =
  "M0,95 L25,88 L50,92 L75,78 L100,82 L125,70 L150,74 L175,58 L200,62 L225,44 L250,48 L275,30 L300,22";

function CardText({
  label,
  labelColor,
  title,
  wide,
  children,
}: {
  label: string;
  labelColor: string;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="lp-card-label" style={{ color: labelColor }}>
        {label}
      </div>
      <h3 className={wide ? "lp-card-title lp-card-title-wide" : "lp-card-title"}>{title}</h3>
      <p className="lp-card-body">{children}</p>
    </>
  );
}

function SyncCard({ lang }: { lang: Lang }) {
  const t = dict[lang].features.sync;
  return (
    <div className="lp-card lp-card-split lp-card-full" style={{ "--lp-card-accent": "#ffd447" } as React.CSSProperties}>
      <div className="lp-card-split-text">
        <CardText label={t.label} labelColor="#ffd447" title={t.title} wide>
          {t.body}
        </CardText>
      </div>
      <div className="lp-chart">
        <svg viewBox="0 0 300 110" aria-hidden="true">
          <line x1="0" x2="300" y1="40" y2="40" stroke="#2b2839" strokeDasharray="4 6" />
          <line x1="0" x2="300" y1="85" y2="85" stroke="#2b2839" strokeDasharray="4 6" />
          <path d={`${LP_PATH} L300,110 L0,110 Z`} fill="#4dd9c0" opacity=".12" />
          <path d={LP_PATH} fill="none" stroke="#4dd9c0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="300" cy="22" r="5" fill="#4dd9c0" />
        </svg>
        <div className="lp-chart-legend">
          <span>{t.chartTop}</span>
          <span style={{ color: "#4dd9c0" }}>{t.chartBottom}</span>
        </div>
      </div>
    </div>
  );
}

function LiveCard({ lang }: { lang: Lang }) {
  const t = dict[lang].features.live;
  return (
    <div className="lp-card lp-card-col" style={{ "--lp-card-accent": "#4ade80" } as React.CSSProperties}>
      <div className="lp-live-pill">
        <span className="lp-pulse-dot lp-pulse-dot-7" />
        <MatchTimer lang={lang} />
      </div>
      <CardText label={t.label} labelColor="#4ade80" title={t.title}>
        {t.body}
      </CardText>
    </div>
  );
}

function VersusCard({ lang }: { lang: Lang }) {
  const t = dict[lang].features.versus;
  return (
    <div className="lp-card lp-card-col" style={{ "--lp-card-accent": "#ffd447" } as React.CSSProperties}>
      <div className="lp-versus">
        <img src={championImage("Kayn")} alt="" width={40} height={40} />
        <span className="lp-versus-vs">vs</span>
        <img src={championImage("Ahri")} alt="" width={40} height={40} style={{ opacity: 0.55 }} />
        <span className="lp-versus-tag">1v1</span>
      </div>
      <CardText label={t.label} labelColor="#ffd447" title={t.title}>
        {t.body}
      </CardText>
    </div>
  );
}

function WallsCard({ lang }: { lang: Lang }) {
  const t = dict[lang].features.walls;
  return (
    <div className="lp-card lp-card-col" style={{ "--lp-card-accent": "#ff5470" } as React.CSSProperties}>
      <div className="lp-walls">
        <div className="lp-wall lp-wall-fame">
          <div className="lp-wall-label">{t.fameLabel}</div>
          <div className="lp-wall-text">{t.fameText}</div>
        </div>
        <div className="lp-wall lp-wall-shame">
          <div className="lp-wall-label">{t.shameLabel}</div>
          <div className="lp-wall-text">{t.shameText}</div>
        </div>
      </div>
      <CardText label={t.label} labelColor="#ff5470" title={t.title}>
        {t.body}
      </CardText>
    </div>
  );
}

function BotCard({ lang }: { lang: Lang }) {
  const t = dict[lang].features.bot;
  return (
    <div className="lp-card lp-card-split" style={{ "--lp-card-accent": "#a98bff" } as React.CSSProperties}>
      <div className="lp-card-split-text">
        <CardText label={t.label} labelColor="#a98bff" title={t.title} wide>
          {t.body}
        </CardText>
      </div>
      <div className="lp-discord">
        <div className="lp-discord-avatar">Z</div>
        <div className="lp-discord-main">
          <div className="lp-discord-author">
            <span className="lp-discord-name">ZANK Bot</span>
            <span className="lp-discord-tag">BOT</span>
          </div>
          <DiscordEmbedMock
            variant="down"
            authorName="NoFlash4U#LAS"
            authorIcon={championImage("Zed")}
            description={<RotatingRoast lang={lang} />}
            fields={[
              { label: t.queueLabel, value: t.queueValue },
              { label: t.championLabel, value: t.championValue },
              { label: t.rankLabel, value: t.rankValue },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export function Features({ lang }: { lang: Lang }) {
  const t = dict[lang].features;
  return (
    <section id="funciones" className="lp-section lp-features">
      <div className="lp-section-head">
        <h2 className="lp-h2 lp-features-title">{t.sectionTitle}</h2>
        <p className="lp-features-lead">{t.sectionLead}</p>
      </div>
      <div className="lp-features-grid">
        <SyncCard lang={lang} />
        <LiveCard lang={lang} />
        <VersusCard lang={lang} />
        <WallsCard lang={lang} />
        <BotCard lang={lang} />
      </div>
    </section>
  );
}
