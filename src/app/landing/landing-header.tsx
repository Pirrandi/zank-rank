import { SessionButton } from "../session-button";
import { Brand } from "./brand";
import { GithubIcon } from "./icons";
import { dict, type Lang } from "./i18n";
import { LanguageSwitcher } from "./language-switcher";
import { GITHUB_URL } from "./links";

export function LandingHeader({ lang }: { lang: Lang }) {
  const t = dict[lang].header;
  return (
    <header className="lp-header">
      <div className="lp-header-inner">
        <Brand className="lp-brand" />
        <nav className="lp-nav" aria-label={t.sectionsAria}>
          <a href="#funciones" className="lp-navlink">
            {t.navFeatures}
          </a>
          <a href="#como" className="lp-navlink">
            {t.navHow}
          </a>
          <a href="#planes" className="lp-navlink">
            {t.navPlans}
          </a>
        </nav>
        <div className="lp-header-session">
          <LanguageSwitcher lang={lang} ariaLabel={t.langSwitchAria} />
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="lp-github-btn" title="GitHub">
            <GithubIcon size={16} />
            <span className="lp-github-btn-text">{t.github}</span>
          </a>
          <SessionButton next="/" />
        </div>
      </div>
    </header>
  );
}
