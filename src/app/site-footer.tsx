import { GithubIcon } from "./landing/icons";
import { GITHUB_REPO, GITHUB_URL } from "./landing/links";

// Footer global (layout raíz): se ve en todas las páginas, incluida la landing.
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <div className="site-footer-logo">
              ZANK<span>.rank</span>
            </div>
            <p className="site-footer-tagline">Tu grupo. Tu ranking.</p>
          </div>

          <nav className="site-footer-links" aria-label="Enlaces del proyecto">
            <a href={GITHUB_URL} target="_blank" rel="noopener" className="site-footer-github">
              <GithubIcon size={16} />
              {GITHUB_REPO}
            </a>
            <a href={`${GITHUB_URL}#-self-hosted-con-docker`} target="_blank" rel="noopener">
              Instálalo en tu servidor
            </a>
            <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener">
              Reportar un problema
            </a>
          </nav>
        </div>

        <div className="site-footer-bottom">
          <span>© {year} zank.rank · Proyecto open source</span>
          <span className="site-footer-legal">
            zank.rank no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni
            de nadie involucrado oficialmente en la producción o gestión de sus propiedades. Riot
            Games y todas las propiedades asociadas son marcas comerciales o marcas registradas de
            Riot Games, Inc.
          </span>
        </div>
      </div>
    </footer>
  );
}
