import Link from "next/link";
import { GithubIcon } from "./icons";
import { dict, type Lang } from "./i18n";
import { LeaderboardDemo } from "./leaderboard-demo";
import { GITHUB_URL } from "./links";
import { PrimaryCta, type CtaTarget } from "./primary-cta";

export function Hero({ cta, viewerHref, lang }: { cta: CtaTarget; viewerHref: string; lang: Lang }) {
  const t = dict[lang].hero;
  return (
    <section className="lp-hero">
      <div className="lp-hero-glow" aria-hidden="true" />
      <div className="lp-hero-copy">
        <div className="lp-badge">
          <span className="lp-pulse-dot" />
          {t.badge}
        </div>
        <h1 className="lp-hero-title">
          {t.titleLine1}
          <br />
          <span className="lp-accent">{t.titleLine2}</span>
        </h1>
        <p className="lp-hero-lead">{t.lead}</p>
        <div className="lp-hero-actions">
          <PrimaryCta cta={cta} variant="hero" />
          <div className="lp-hero-sub">
            <Link href={viewerHref} className="lp-textlink">
              {t.viewerLink}
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener" className="lp-navlink lp-oss-link">
              <GithubIcon size={14} />
              {t.ossLink}
            </a>
          </div>
        </div>
      </div>
      <LeaderboardDemo lang={lang} />
    </section>
  );
}
